# backend/Dockerfile
FROM node:20-slim
WORKDIR /app

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install pm2 globally
RUN npm install -g pm2

# Copy root package files
COPY package.json package-lock.json ./
COPY packages/ ./packages/
COPY backend/ ./backend/

# Install dependencies
RUN npm install

# Build shared packages
RUN npm run build:shared

# Build backend
WORKDIR /app/backend
RUN npx prisma generate
RUN npm run build

# Expose API port (default from server.ts)
EXPOSE 4000

# Run both server and worker via PM2 in production mode
CMD ["pm2-runtime", "start", "ecosystem.config.cjs", "--env", "production"]
