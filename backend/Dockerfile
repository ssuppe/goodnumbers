# backend/Dockerfile
FROM node:20-slim
WORKDIR /app

# 1. Install openssl and pm2
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN npm install -g pm2

# 2. Copy the entire pre-built source from host N100
# This includes the 'dist' folders for our shared packages!
COPY . .

# 3. Install dependencies (creates symlinks)
RUN npm install

# 4. Generate Prisma and Build the final backend
WORKDIR /app/backend
RUN npx prisma@6 generate
RUN npm run build

# Expose API port
EXPOSE 4000

# Run via PM2
WORKDIR /app/backend
CMD ["pm2-runtime", "start", "ecosystem.config.cjs", "--env", "production"]
