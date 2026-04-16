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


# --- DEVELOPMENT WORKFLOWS ---
# --- PRODUCTION DEPLOYMENT (MODERN MAZEL) ---

SERVER_IP := "34.46.45.86"

# Push local production secrets to the VM
push-secrets:
    @echo "Pushing production env and keys to {{SERVER_IP}}..."
    # Ensure .env.production exists locally first
    @if [ ! -f ".env.production" ]; then echo "Error: .env.production not found. Create it from backend/.env.example first."; exit 1; fi
    scp .env.production root@{{SERVER_IP}}:/root/app/.env.production
    ssh root@{{SERVER_IP}} "mkdir -p /etc/goodnumbers/secrets"
    @if [ -f "/home/clark/.gcp/gcp-key.json" ]; then scp /home/clark/.gcp/gcp-key.json root@{{SERVER_IP}}:/etc/goodnumbers/secrets/gcp-key.json; \
     else echo "Warning: No gcp-key.json found locally. You may need to push it manually."; fi

# The main deployment command
deploy:
    @echo "Deploying GoodNumbers to production..."
    ssh root@{{SERVER_IP}} "cd app && git pull origin main && docker compose up -d --build"

# View production logs remotely
logs-prod:
    ssh root@{{SERVER_IP}} "cd app && docker compose logs -f"

# Runs the backend development server.
dev-backend:
    @npm run dev -w backend

# Runs the frontend development server.
dev-frontend:
    @npm run dev -w frontend


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
