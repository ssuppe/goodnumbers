# backend/Dockerfile
FROM node:20-slim
WORKDIR /app

# 1. Install openssl and pm2
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pm2

# 2. Copy the pre-built source (including host-built 'dist' and prisma client)
COPY . .

# 3. Install production dependencies
RUN npm install --omit=dev --legacy-peer-deps

# 4. Generate Prisma inside container (ensures correct engine for the OS)
WORKDIR /app/backend
RUN npx prisma@6 generate

# Expose API port
EXPOSE 4000

# Run via PM2
CMD ["pm2-runtime", "start", "ecosystem.config.cjs", "--env", "production"]
