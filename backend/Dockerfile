# backend/Dockerfile
FROM node:20-slim
WORKDIR /app

# 1. Install system deps and pm2
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pm2

# 2. Copy ONLY package manifests first so npm install is cached
#    unless dependencies actually change.
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/
COPY packages/ ./packages/

# 3. Install dependencies (cached layer — only re-runs on package.json changes)
RUN npm install --legacy-peer-deps --ignore-scripts

# 4. Copy the rest of the source
COPY . .

# 5. Generate Prisma and Build
WORKDIR /app/backend
RUN npx prisma@6 generate
RUN npm run build

# 6. Cleanup dev dependencies to keep the image small
WORKDIR /app
RUN npm prune --production --legacy-peer-deps

# Expose API port
EXPOSE 4000

# Run via PM2
WORKDIR /app/backend
CMD ["pm2-runtime", "start", "ecosystem.config.cjs", "--env", "production"]
