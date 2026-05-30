# file: justfile
# This is the master command runner for the Goodnumbers monorepo.
# All commands should be run from the project root.

# --- DEPLOYMENT CONFIG (Override in .env or shell) ---
SERVER_IP           := env_var_or_default("DEPLOY_SERVER_IP", "your-server-ip")
SERVER_USER         := env_var_or_default("DEPLOY_SERVER_USER", "your-username")
GCP_KEY_LOCAL       := env_var_or_default("GCP_KEY_PATH", "~/.gcp/goodnumbers-key.json")
GCP_KEY_PATH_SERVER := env_var_or_default("GCP_KEY_PATH_SERVER", "/home/" + SERVER_USER + "/secrets/gcp-key.json")
ARTIFACT_DIR        := "./deploy-artifacts"

# --- ENV 1: LOCAL DEVELOPMENT ---
# Starts Redis and then runs backend, worker, and frontend concurrently.
dev: services-up
    #!/usr/bin/env bash
    trap 'kill 0' EXIT
    echo "Starting application services (Backend, Worker, Frontend)..."
    just dev-backend & \
    just dev-worker & \
    just dev-frontend & \
    wait

# Starts the Redis container required by the backend in local dev.
services-up:
    @echo "Starting Redis container..."
    @docker compose up -d redis

# Stops and removes the Redis container.
services-down:
    @echo "Stopping and removing Redis container..."
    @docker compose down

# --- ENV 2: LOCAL DOCKER PRODUCTION ---
# Runs the full production-style stack locally in Docker for testing.
# Usage: just docker-prod [192.168.1.3.nip.io]
docker-prod host="localhost": build-local _db-docker-prompt
    @echo "🚀 Starting GoodNumbers in Docker (Local Production Mode)..."
    @echo "📡 Access mode: http://{{host}}:8100"
    @GCP_KEY_PATH={{GCP_KEY_LOCAL}} GN_HOST={{host}} docker compose -f docker-compose.yml -f docker-compose.local.yml up -d
    @echo "✨ App is running at http://{{host}}:8100"

_db-docker-prompt:
    #!/usr/bin/env bash
    if [ -t 0 ]; then
        echo "📊 Local Docker Database handling:"
        echo "1) Keep current local dev.db (default)"
        echo "2) Reset local dev.db (WIPES ALL DATA)"
        read -p "Select [1-2]: " choice
        case $choice in
            2) just db-reset-dev ;;
            *) echo "Keeping current DB." ;;
        esac
    fi

# Stops the local Docker stack
docker-prod-down:
    docker compose -f docker-compose.yml -f docker-compose.local.yml down

# Views logs for the local Docker stack
docker-prod-logs:
    docker compose -f docker-compose.yml -f docker-compose.local.yml logs -f

# --- ENV 3: VPS DEPLOYMENT ---
# The main deployment command (One-touch deploy to VPS via SSH)
deploy: build-local _db-deploy-prompt package-local push-all
    @echo "Finalizing deployment on the VM..."
    ssh -t {{SERVER_USER}}@{{SERVER_IP}} "cd app && \
        cp .env.production .env && \
        if [ -f \"deploy-artifacts/dev.db\" ]; then \
            echo '--- Overwriting Production Database with Local Copy ---' && \
            mv deploy-artifacts/dev.db backend/prisma/dev.db; \
        fi && \
        echo '--- Loading Backend Image ---' && \
        ((pv deploy-artifacts/backend.tar.gz 2>/dev/null || cat deploy-artifacts/backend.tar.gz) | docker load) || (rm -rf deploy-artifacts/*.tar.gz && exit 1) && \
        echo '--- Loading Frontend Image ---' && \
        ((pv deploy-artifacts/frontend.tar.gz 2>/dev/null || cat deploy-artifacts/frontend.tar.gz) | docker load) || (rm -rf deploy-artifacts/*.tar.gz && exit 1) && \
        echo '--- Stopping Stack for Update ---' && \
        GCP_KEY_PATH_SERVER={{GCP_KEY_PATH_SERVER}} docker compose -f docker-compose.yml -f docker-compose.prod.yml down && \
        if [ -f \"deploy-artifacts/dev.db\" ]; then \
            echo '--- Overwriting Production Database with Local Copy ---' && \
            mv deploy-artifacts/dev.db backend/prisma/dev.db; \
        fi && \
        echo '--- Restarting Containers (Production Mode) ---' && \
        GCP_KEY_PATH_SERVER={{GCP_KEY_PATH_SERVER}} docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d && \
        if [ -f \"deploy-artifacts/.reset_db\" ]; then \
            echo '--- Resetting Production Database ---' && \
            docker exec app-backend-1 npx prisma db push --schema=/app/backend/prisma/schema.prisma --force-reset --accept-data-loss; \
            rm deploy-artifacts/.reset_db; \
        else \
            echo '--- Syncing Database Schema ---' && \
            docker exec app-backend-1 npx prisma db push --schema=/app/backend/prisma/schema.prisma --accept-data-loss; \
        fi && \
        echo '--- Cleaning up artifacts and old images ---' && \
        rm -rf deploy-artifacts/*.tar.gz && \
        docker image prune -f"

_db-deploy-prompt:
    #!/usr/bin/env bash
    mkdir -p {{ARTIFACT_DIR}}
    rm -f {{ARTIFACT_DIR}}/.reset_db
    if [ -t 0 ]; then
        echo "🚀 Production Database handling:"
        echo "1) Keep current production DB (default)"
        echo "2) Copy local dev.db to production (OVERWRITES PROD)"
        echo "3) Reset production DB (WIPES PROD DATA)"
        read -p "Select [1-3]: " choice
        case $choice in
            2) 
                echo "Queuing database copy..."
                cp backend/prisma/dev.db {{ARTIFACT_DIR}}/dev.db
                ;;
            3) 
                echo "Queuing production database reset..."
                touch {{ARTIFACT_DIR}}/.reset_db
                ;;
            *) echo "Keeping current production DB." ;;
        esac
    fi

# --- SETUP & INITIALIZATION ---
setup:
    @echo "🚀 Starting GoodNumbers setup..."
    @if [ ! -f ".env" ]; then cp .env.example .env && echo "✅ Created .env from template"; fi
    @echo "📦 Installing dependencies..."
    @npm install --legacy-peer-deps
    @echo "🏗️ Generating Prisma client & building packages..."
    @just generate
    @echo "✨ Setup complete! Run 'just services-up' then 'just dev' to start."

generate:
    @echo "Generating Prisma client..."
    @npx prisma generate --schema=./backend/prisma/schema.prisma
    @echo "Pushing schema to database..."
    @npx prisma db push --schema=./backend/prisma/schema.prisma --accept-data-loss
    @echo "Building shared packages..."
    @npx tsc -b --clean && npx tsc -b

# --- UTILITY COMMANDS ---
redis-flush:
    @echo "Flushing local Redis..."
    @docker exec goodnumbers-clean-redis-1 redis-cli -a ${REDIS_PASSWORD} FLUSHALL

db-reset-dev:
    @echo "Resetting local development database..."
    @cd backend && PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION=yes npx prisma migrate reset --force

dev-backend:
    @npm run dev -w backend

dev-worker:
    @npm run dev:worker -w backend

dev-frontend:
    @npm run dev -w frontend

# --- BUILD & PACKAGE ---
_build-backend:
    @echo "Building Backend Docker image..."
    docker build -t goodnumbers-backend:latest -f backend/Dockerfile .

_build-frontend:
    @echo "Building Frontend Docker image..."
    docker build -t goodnumbers-frontend:latest -f frontend/Dockerfile .

[parallel]
build-local: generate _build-backend _build-frontend

_package-backend:
    @echo "Packaging Backend..."
    mkdir -p {{ARTIFACT_DIR}}
    docker save goodnumbers-backend:latest | gzip --rsyncable > {{ARTIFACT_DIR}}/backend.tar.gz

_package-frontend:
    @echo "Packaging Frontend..."
    mkdir -p {{ARTIFACT_DIR}}
    docker save goodnumbers-frontend:latest | gzip --rsyncable > {{ARTIFACT_DIR}}/frontend.tar.gz

[parallel]
package-local: _package-backend _package-frontend
    @echo "All artifacts packaged."

push-all:
    @echo "Pushing secrets and image artifacts to {{SERVER_IP}}..."
    @if [ ! -f ".env.production" ]; then echo "Error: .env.production not found."; exit 1; fi
    ssh {{SERVER_USER}}@{{SERVER_IP}} "mkdir -p /home/{{SERVER_USER}}/app/deploy-artifacts /home/{{SERVER_USER}}/secrets"
    scp .env.production {{SERVER_USER}}@{{SERVER_IP}}:/home/{{SERVER_USER}}/app/.env.production
    @if [ -f "{{GCP_KEY_LOCAL}}" ]; then \
        scp {{GCP_KEY_LOCAL}} {{SERVER_USER}}@{{SERVER_IP}}:/home/{{SERVER_USER}}/secrets/gcp-key.json; \
    fi
    rsync -avzhP {{ARTIFACT_DIR}}/ {{SERVER_USER}}@{{SERVER_IP}}:/home/{{SERVER_USER}}/app/deploy-artifacts/
    scp docker-compose.yml docker-compose.prod.yml Caddyfile {{SERVER_USER}}@{{SERVER_IP}}:/home/{{SERVER_USER}}/app/

logs-prod:
    ssh {{SERVER_USER}}@{{SERVER_IP}} "cd app && docker compose logs -f"

db-reset-prod:
    ssh {{SERVER_USER}}@{{SERVER_IP}} "docker exec app-backend-1 npx prisma db push --force-reset"

# --- TESTING ---
test:
    @echo "Running all tests..."
    @just test-backend
    @just test-frontend

test-backend:
    @npm test -w backend

test-frontend:
    @npm test -w frontend

test-ci-backend:
    @just services-up
    @npm test -w backend
    @just services-down

# --- OTHER ---
tmux:
    #!/usr/bin/env zsh
    tmux has-session -t GN 2>/dev/null || tmux new-session -s GN -d
    tmux rename-window -t GN:0 'Proxy'
    tmux send-keys -t GN:0 "cd {{invocation_directory()}} && npx @srbhptl39/mcp-superassistant-proxy@latest --config ./mcp.json --host 0.0.0.0" C-m
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
