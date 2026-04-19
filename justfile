# file: justfile
# This is the master command runner for the Goodnumbers monorepo.
# All commands should be run from the project root.

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

# --- PRODUCTION DEPLOYMENT (BUILD ON N100) ---

SERVER_IP := "34.46.45.86"
ARTIFACT_DIR := "./deploy-artifacts"

# Sequential host setup required before Docker builds
_host-setup:
    @echo "Generating Prisma client and building shared packages on host N100..."
    npx prisma@6 generate --schema=./backend/prisma/schema.prisma
    npx tsc -b --clean && npx tsc -b

_build-backend:
    @echo "Building Backend Docker image..."
    docker build -t goodnumbers-backend:latest -f backend/Dockerfile .

_build-frontend:
    @echo "Building Frontend Docker image..."
    docker build -t goodnumbers-frontend:latest -f frontend/Dockerfile .

# Main build recipe using parallel dependencies
[parallel]
build-local: _host-setup _build-backend _build-frontend

_package-backend:
    @echo "Packaging Backend..."
    docker save goodnumbers-backend:latest | gzip > {{ARTIFACT_DIR}}/backend.tar.gz

_package-frontend:
    @echo "Packaging Frontend..."
    docker save goodnumbers-frontend:latest | gzip > {{ARTIFACT_DIR}}/frontend.tar.gz

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
    ssh ssuppe@{{SERVER_IP}} "mkdir -p /home/ssuppe/app/deploy-artifacts /home/ssuppe/secrets"
    scp .env.production ssuppe@{{SERVER_IP}}:/home/ssuppe/app/.env.production
    @if [ ! -f "/home/clark/.gcp/goodnumbers-key.json" ]; then \
        if [ -f "/home/clark/.gcp/gcp-key.json" ]; then \
            scp /home/clark/.gcp/gcp-key.json ssuppe@{{SERVER_IP}}:/home/ssuppe/secrets/gcp-key.json; \
        fi; \
    else \
        scp /home/clark/.gcp/goodnumbers-key.json ssuppe@{{SERVER_IP}}:/home/ssuppe/secrets/gcp-key.json; \
    fi
    rsync -avzhP {{ARTIFACT_DIR}}/ ssuppe@{{SERVER_IP}}:/home/ssuppe/app/deploy-artifacts/
    scp docker-compose.yml Caddyfile ssuppe@{{SERVER_IP}}:/home/ssuppe/app/

# The main deployment command (One-touch deploy)
deploy: build-local package-local push-all
    @echo "Finalizing deployment on the VM..."
    ssh -t ssuppe@{{SERVER_IP}} "cd app && \
        cp .env.production .env && \
        echo '--- Loading Backend Image ---' && \
        (pv deploy-artifacts/backend.tar.gz 2>/dev/null || cat deploy-artifacts/backend.tar.gz) | docker load && \
        echo '--- Loading Frontend Image ---' && \
        (pv deploy-artifacts/frontend.tar.gz 2>/dev/null || cat deploy-artifacts/frontend.tar.gz) | docker load && \
        docker compose up -d && \
        rm -rf deploy-artifacts/*.tar.gz"

# View production logs remotely
logs-prod:
    ssh ssuppe@{{SERVER_IP}} "cd app && docker compose logs -f"

# Hard reset the production database (WIPES ALL DATA)
db-reset-prod:
    ssh ssuppe@{{SERVER_IP}} "docker exec app-backend-1 npx prisma db push --force-reset"


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
    tmux send-keys -t GN:0 'cd ~/dev/goodnumbers-workspace && npx @srbhptl39/mcp-superassistant-proxy@latest --config ./mcp.json --host 0.0.0.0' C-m

    # Window 1: Workspace
    tmux has-session -t GN:1 2>/dev/null || tmux new-window -t GN:1 -n 'Workspace'
    
    # --- THE FIX IS HERE ---
    sleep 0.2 
    # -----------------------

    PANE_COUNT=$(tmux list-panes -t GN:1 | wc -l)
    if [ "$PANE_COUNT" -eq 1 ]; then
        # Force the splits to happen on Window 1 specifically
        tmux split-window -h -t GN:1 -l 20
        sleep 0.1
        #tmux split-window -v -t GN:1.1
        
        tmux send-keys -t GN:1.1 'export FORCE_COLOR=3; just dev' 
        #tmux send-keys -t GN:1.2 'npx prisma studio'
    fi

    tmux select-window -t GN:1
    tmux select-pane -t GN:1.0
    
    [ -z "$TMUX" ] && tmux attach-session -t GN || tmux switch-client -t GN
