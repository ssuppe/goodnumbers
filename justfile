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
# Starts the full development environment: Redis, backend, and frontend.
dev:
    @echo "Starting full development environment..."
    @just services-up
    @npm run dev:backend & npm run dev:worker -w backend & npm run dev:frontend

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
