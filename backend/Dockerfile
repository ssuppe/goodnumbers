# backend/Dockerfile
FROM node:20-slim
WORKDIR /app

# 1. Install openssl (for Prisma) and pm2
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pm2

# 2. Copy Root Configs
COPY package*.json tsconfig*.json ./

# 3. Copy ALL package.json files to maintain monorepo symlinks
COPY packages/types/package.json ./packages/types/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/common/package.json ./packages/common/
COPY backend/package.json ./backend/

# 4. Install Dependencies
RUN npm install

# 5. Copy Prisma Schema & Generate (Critical for @goodnumbers/types)
COPY backend/prisma ./backend/prisma/
WORKDIR /app/backend
RUN npx prisma@6 generate

# 6. Copy ALL Source Code
WORKDIR /app
COPY . .

# 7. Build everything from the root using Build Mode
RUN npx tsc -b

# Expose API port
EXPOSE 4000

# Run via PM2
WORKDIR /app/backend
CMD ["pm2-runtime", "start", ecosystem.config.cjs, "--env", "production"]
