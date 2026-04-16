# backend/Dockerfile
FROM node:20-slim
WORKDIR /app

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install pm2 globally
RUN npm install -g pm2

# Copy root package files and monorepo structure
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY backend/ ./backend/

# Install dependencies (from root to leverage workspaces)
RUN npm install

# Generate Prisma client and build shared packages
WORKDIR /app/backend
RUN npx prisma generate
WORKDIR /app
RUN npm run build:shared

# Build backend
WORKDIR /app/backend
RUN npm run build

# Expose API port
EXPOSE 4000

# Run both server and worker via PM2
CMD ["pm2-runtime", "start", "ecosystem.config.cjs", "--env", "production"]
