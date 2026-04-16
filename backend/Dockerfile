# backend/Dockerfile
FROM node:20-slim
WORKDIR /app

# 1. Install openssl and pm2
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pm2

# 2. Copy the entire pre-built source
COPY . .

# 3. Install ALL dependencies (needed for npm run build)
RUN npm install --legacy-peer-deps --ignore-scripts

# 4. Generate Prisma and Build
WORKDIR /app/backend
RUN npx prisma@6 generate
RUN npm run build

# 5. Cleanup dev dependencies to keep the image small
WORKDIR /app
RUN npm prune --production --legacy-peer-deps

# Expose API port
EXPOSE 4000

# Run via PM2
WORKDIR /app/backend
CMD ["pm2-runtime", "start", "ecosystem.config.cjs", "--env", "production"]
