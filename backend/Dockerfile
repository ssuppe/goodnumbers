# backend/Dockerfile
FROM node:20-slim
WORKDIR /app

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install pm2 globally
RUN npm install -g pm2

# 1. Copy package files for caching
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/common/package.json ./packages/common/
COPY backend/package.json ./backend/

# 2. Install dependencies (creates symlinks in node_modules)
RUN npm install

# 3. Copy source code
COPY packages/ ./packages/
COPY backend/ ./backend/

# 4. Generate Prisma and Build everything using Project References
WORKDIR /app/backend
RUN npx prisma@6 generate
WORKDIR /app
RUN npx tsc --build

# Expose API port
EXPOSE 4000

# Run both server and worker via PM2
WORKDIR /app/backend
CMD ["pm2-runtime", "start", "ecosystem.config.cjs", "--env", "production"]
