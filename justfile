# file: justfile
# This is the master command runner for the Goodnumbers monorepo.
# All commands should be run from the project root.

# --- DEPLOYMENT CONFIG (Override in .env or shell) ---
SERVER_IP     := env_var_or_default("DEPLOY_SERVER_IP", "your-server-ip")
SERVER_USER   := env_var_or_default("DEPLOY_SERVER_USER", "your-username")
GCP_KEY_LOCAL := env_var_or_default("GCP_KEY_PATH", "~/.gcp/goodnumbers-key.json")
ARTIFACT_DIR  := "./deploy-artifacts"

# --- SETUP & INITIALIZATION ---
# Initial project setup for new contributors
setup:
    @echo "🚀 Starting GoodNumbers setup..."
    @if [ ! -f ".env" ]; then cp .env.example .env && echo "✅ Created .env from template"; fi
    @echo "📦 Installing dependencies..."
    @npm install --legacy-peer-deps
    @echo "🏗️ Generating Prisma client & building packages..."
    @just generate
    @echo "✨ Setup complete! Run 'just services-up' then 'just dev' to start."

# Unifies schema generation and DB push
generate:
    @echo "Generating Prisma client..."
    @npx prisma generate --schema=./backend/prisma/schema.prisma
    @echo "Pushing schema to database..."
    @npx prisma db push --schema=./backend/prisma/schema.prisma --accept-data-loss
    @echo "Building shared packages..."
    @npx tsc -b --clean && npx tsc -b

# --- SERVICE MANAGEMENT (for Development & Testing) ---
# Starts the Redis container required by the backend.
services-up:
    @echo "Starting Redis container..."
    @docker compose up -d redis

# Stops and removes the Redis container.
services-down:
    @echo "Stopping and removing Redis container..."
    @docker compose down

# Flushes all data from local Redis (clears queues).
redis-flush:
    @echo "Flushing local Redis..."
    @docker exec goodnumbers-clean-redis-1 redis-cli -a ${REDIS_PASSWORD} FLUSHALL

# Hard resets the local development database.
db-reset-dev:
    @echo "Resetting local development database..."
    @cd backend && PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes npx prisma migrate reset --force

# Runs the backend development server.
dev-backend:
    @npm run dev -w backend

# Runs the backend background worker.
dev-worker:
    @npm run dev:worker -w backend

# Runs the frontend development server.
dev-frontend:
    @npm run dev -w frontend

# Runs backend, worker, and frontend concurrently in the foreground.
dev:
    #!/usr/bin/env bash
    trap 'kill 0' EXIT
    echo "Starting all services (Backend, Worker, Frontend)..."
    just dev-backend & \
    just dev-worker & \
    just dev-frontend & \
    wait

# --- PRODUCTION DEPLOYMENT ---

_build-backend:
    @echo "Building Backend Docker image..."
    docker build -t goodnumbers-backend:latest -f backend/Dockerfile .

_build-frontend:
    @echo "Building Frontend Docker image..."
    docker build -t goodnumbers-frontend:latest -f frontend/Dockerfile .

# Main build recipe using parallel dependencies
[parallel]
build-local: generate _build-backend _build-frontend

_package-backend:
    @echo "Packaging Backend..."
    docker save goodnumbers-backend:latest | gzip --rsyncable > {{ARTIFACT_DIR}}/backend.tar.gz

_package-frontend:
    @echo "Packaging Frontend..."
    docker save goodnumbers-frontend:latest | gzip --rsyncable > {{ARTIFACT_DIR}}/frontend.tar.gz

# Main package recipe using parallel dependencies
[parallel]
package-local: _package-backend _package-frontend
    @# This line runs after parallel deps finish
    @echo "All artifacts packaged."

# Push local production secrets and images to the VM
push-all:
    @echo "Pushing secrets and image artifacts to {{SERVER_IP}}..."
    # Ensure .env.production exists
    @if [ ! -f ".env.production" ]; then echo "Error: .env.production not found."; exit 1; fi
    ssh {{SERVER_USER}}@{{SERVER_IP}} "mkdir -p /home/{{SERVER_USER}}/app/deploy-artifacts /home/{{SERVER_USER}}/secrets"
    scp .env.production {{SERVER_USER}}@{{SERVER_IP}}:/home/{{SERVER_USER}}/app/.env.production
    @if [ -f "{{GCP_KEY_LOCAL}}" ]; then \
        scp {{GCP_KEY_LOCAL}} {{SERVER_USER}}@{{SERVER_IP}}:/home/{{SERVER_USER}}/secrets/gcp-key.json; \
    fi
    rsync -avzhP {{ARTIFACT_DIR}}/ {{SERVER_USER}}@{{SERVER_IP}}:/home/{{SERVER_USER}}/app/deploy-artifacts/
    scp docker-compose.yml Caddyfile {{SERVER_USER}}@{{SERVER_IP}}:/home/{{SERVER_USER}}/app/

# The main deployment command (One-touch deploy)
deploy: build-local package-local push-all
    @echo "Finalizing deployment on the VM..."
    ssh -t {{SERVER_USER}}@{{SERVER_IP}} "cd app && \
        cp .env.production .env && \
        echo '--- Loading Backend Image ---' && \
        ((pv deploy-artifacts/backend.tar.gz 2>/dev/null || cat deploy-artifacts/backend.tar.gz) | docker load) || (rm -rf deploy-artifacts/*.tar.gz && exit 1) && \
        echo '--- Loading Frontend Image ---' && \
        ((pv deploy-artifacts/frontend.tar.gz 2>/dev/null || cat deploy-artifacts/frontend.tar.gz) | docker load) || (rm -rf deploy-artifacts/*.tar.gz && exit 1) && \
        echo '--- Restarting Containers ---' && \
        docker compose up -d && \
        echo '--- Syncing Database Schema ---' && \
        docker exec app-backend-1 npx prisma db push --schema=/app/backend/prisma/schema.prisma --accept-data-loss && \
        echo '--- Cleaning up artifacts and old images ---' && \
        rm -rf deploy-artifacts/*.tar.gz && \
        docker image prune -f"

# View production logs remotely
logs-prod:
    ssh {{SERVER_USER}}@{{SERVER_IP}} "cd app && docker compose logs -f"

# Hard reset the production database (WIPES ALL DATA)
db-reset-prod:
    ssh {{SERVER_USER}}@{{SERVER_IP}} "docker exec app-backend-1 npx prisma db push --force-reset"


# --- TESTING WORKFLOWS ---
# Runs all tests for all workspaces (backend and frontend).
test:
    @echo "Running all tests..."
    @just test-backend
    @just test-frontend

# Runs the backend test suite.
test-backend:
    @echo "Running backend tests..."
    @npm test -w backend

# Runs the frontend test suite.
test-frontend:
    @echo "Running frontend tests..."
    @npm test -w frontend

# Runs a full CI-style test cycle for the backend locally.
test-ci-backend:
    @echo "Running CI test cycle for backend: Starting services -> Running tests -> Tearing down..."
    @just services-up
    @npm test -w backend
    @just services-down

# Setup the full development environment in Tmux
tmux:
    #!/usr/bin/env zsh
    tmux has-session -t GN 2>/dev/null || tmux new-session -s GN -d
    
    # Window 0: Proxy
    tmux rename-window -t GN:0 'Proxy'
    tmux send-keys -t GN:0 "cd {{invocation_directory()}} && npx @srbhptl39/mcp-superassistant-proxy@latest --config ./mcp.json --host 0.0.0.0" C-m

    # Window 1: Workspace
    tmux has-session -t GN:1 2>/dev/null || tmux new-window -t GN:1 -n 'Workspace'
    
    sleep 0.2 

    PANE_COUNT=$(tmux list-panes -t GN:1 | wc -l)
    if [ "$PANE_COUNT" -eq 1 ]; then
        tmux split-window -h -t GN:1 -l 20
        sleep 0.1
        
        tmux send-keys -t GN:1.1 'export FORCE_COLOR=3; just dev' 
    fi

    tmux select-window -t GN:1
    tmux select-pane -t GN:1.0
    
    [ -z "$TMUX" ] && tmux attach-session -t GN || tmux switch-client -t GN

    # Window 1: Workspace
    tmux has-session -t GN:1 2>/dev/null || tmux new-window -t GN:1 -n 'Workspace'
    
    sleep 0.2 

    PANE_COUNT=$(tmux list-panes -t GN:1 | wc -l)
    if [ "$PANE_COUNT" -eq 1 ]; then
        tmux split-window -h -t GN:1 -l 20
        sleep 0.1
        
        tmux send-keys -t GN:1.1 'export FORCE_COLOR=3; just dev' 
    fi

    tmux select-window -t GN:1
    tmux select-pane -t GN:1.0
    
    [ -z "$TMUX" ] && tmux attach-session -t GN || tmux switch-client -t GN
