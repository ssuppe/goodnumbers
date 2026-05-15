# Engineering Plan: Modern Mazel Deployment 🚀

**Status**: Draft
**Author**: Senior Tech Lead
**Target**: Google Cloud Compute Engine (e2-micro)
**Reference**: Based on the successful `mazelmessages` architecture.

## 1. Overview

This plan outlines the migration from a manual "Tarball" deployment to a modern, automated "Git + Docker Compose" workflow. We will use **Caddy** as a reverse proxy to handle SSL and routing, and **PM2** to manage our backend processes (Server + Worker) within a single container to save resources on our GCP Free Tier VM.

---

## 2. Prerequisites (Checklist)

Before starting, ensure the junior engineer has:

- [ ] SSH access to the GCP VM (`ssh your-user@goodnumbers.net`).
- [ ] A domain name (`goodnumbers.net`) pointing to the VM's static IP.
- [ ] Docker and Docker Compose installed on the VM.
- [ ] Local `.env.production` and the GCP Service Account JSON key.

---

## 3. Phase 1: Project Hygiene & Branching

**Goal**: Establish a clean workspace and track progress.

### Step 1.1: Create the GitHub Issue

Use the GitHub CLI to track this work:

```bash
gh issue create --title "infra: Implement Modern Mazel Deployment" \
  --body "Restore GCP deployment using a modern Docker Compose + Caddy architecture. Closes the deployment restoration task."
```

### Step 1.2: Branch Setup

```bash
git checkout main
git pull origin main
git checkout -b feat/modern-mazel-deployment
```

---

## 4. Phase 2: Dockerization (The Monorepo Way)

**Goal**: Create optimized Docker images that handle our shared packages.

### Step 2.1: Frontend Dockerfile

Create `frontend/Dockerfile`. We use a multi-stage build to keep the final image small.

- **Stage 1**: Build the React app.
- **Stage 2**: Serve with Nginx.

```dockerfile
# frontend/Dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY frontend/ ./frontend/
RUN npm install
RUN npm run build:shared
WORKDIR /app/frontend
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
# Custom nginx config to handle SPA routing
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Step 2.2: Backend Dockerfile

Create `backend/Dockerfile`. This runs both the API and the Worker via PM2.

```dockerfile
# backend/Dockerfile
FROM node:20-slim
WORKDIR /app
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pm2
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY backend/ ./backend/
RUN npm install
RUN npm run build:shared
WORKDIR /app/backend
RUN npx prisma generate
RUN npm run build
EXPOSE 4000
CMD ["pm2-runtime", "start", "ecosystem.config.cjs", "--env", "production"]
```

---

## 5. Phase 3: Orchestration (Docker Compose & Caddy)

**Goal**: Wire the services together.

### Step 3.1: The Caddyfile

Create `Caddyfile` in the project root. This is our "Traffic Controller".

```caddy
# Caddyfile
goodnumbers.net {
    # Route API and Auth requests to the backend
    reverse_proxy /api/* backend:4000
    reverse_proxy /auth/* backend:4000

    # Route everything else to the frontend
    reverse_proxy * frontend:80
}
```

### Step 3.2: Production Docker Compose

Create `docker-compose.yml` in the project root.

```yaml
services:
  backend:
    build:
      context: .
      dockerfile: backend/Dockerfile
    env_file: .env.production
    volumes:
      - ./backend/prisma/dev.db:/app/backend/prisma/dev.db
      - /etc/goodnumbers/secrets/gcp-key.json:/app/gcp-key.json:ro
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    restart: unless-stopped

  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - backend
      - frontend
    restart: unless-stopped

  redis:
    image: redis:alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    restart: unless-stopped

volumes:
  caddy_data:
  caddy_config:
```

---

## 6. Phase 4: VM Hardening (The "e2-micro" Fix)

**Goal**: Prevent "Out of Memory" crashes.

**Junior Task**: SSH into the VM and run these commands once.

```bash
# Create a 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
# Make it persistent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## 7. Phase 5: Automation (The Justfile)

**Goal**: Make deployment easy and repeatable.

Add these to the root `Justfile`:

```justfile
SERVER_IP := "your-vm-ip"

# Push local production secrets to the VM
push-secrets:
    @echo "Pushing production env and keys..."
    scp .env.production root@{{SERVER_IP}}:/root/app/.env.production
    ssh root@{{SERVER_IP}} "mkdir -p /etc/goodnumbers/secrets"
    scp path/to/your/gcp-key.json root@{{SERVER_IP}}:/etc/goodnumbers/secrets/gcp-key.json

# The main deployment command
deploy:
    ssh root@{{SERVER_IP}} "cd app && git pull origin main && docker compose up -d --build"
```

---

## 8. Verification & TDD

**Goal**: Empirically prove the system works.

1.  **Connectivity Test**: `curl -I https://goodnumbers.net/api/health` should return `200 OK`.
2.  **SSL Test**: Browser should show a padlock icon on the domain.
3.  **Persistence Test**:
    - Create a journal entry.
    - Run `just deploy` (to restart containers).
    - Refresh the page. The entry **must** still be there (verifies SQLite volume mount).
4.  **Worker Test**: Run `docker compose logs -f backend` and verify you see `[Worker] Listening for jobs...`.

---

## 9. Troubleshooting

- **SIGKILL during build**: Increase swap file size or build locally and push the image (if swap fails).
- **502 Bad Gateway**: Check `docker compose logs caddy`. Usually means the backend container is still starting up or crashed.
- **OAuth Fail**: Check if the Redirect URI in Google Cloud Console matches `https://goodnumbers.net/api/auth/callback/google`.

## 10. Storage Management (Free Tier Protection)

**Goal**: Prevent "No space left on device" errors on limited 30GB disks.

### Step 10.1: Automated Image Pruning

Update the `deploy` recipe in your `Justfile` to clean up old images _after_ a successful deployment. This ensures that only the currently running images occupy space.

```justfile
deploy:
    ssh -t ssuppe@{{SERVER_IP}} "cd app && \
        echo '--- Loading Images ---' && \
        (docker load < artifacts.tar.gz) && \
        echo '--- Restarting Containers ---' && \
        docker compose up -d && \
        echo '--- Cleaning up ---' && \
        docker image prune -f"
```

### Step 10.2: Log Rotation

Ensure your `docker-compose.yml` has log rotation configured for all services. Without this, Docker logs will grow indefinitely until the disk is full.

```yaml
services:
  backend:
    ...
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### Step 10.3: Emergency Cleanup

If the disk ever hits 100%, run this command to immediately reclaim space:

```bash
ssh ssuppe@{{SERVER_IP}} "docker system prune -af"
```

## 11. Transfer Optimization

**Goal**: Speed up deployments and reduce bandwidth usage.

### Step 11.1: Rsync-Friendly Compression

The `Justfile` now uses `gzip --rsyncable`.

- **Why**: Standard gzip changes the entire compressed output even for small changes in the input.
- **Benefit**: `--rsyncable` ensures that only the changed parts of the Docker image layers are sent over the network, making subsequent `rsync` operations much faster.
