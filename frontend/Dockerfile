# frontend/Dockerfile
FROM node:20-slim AS build
WORKDIR /app

# Install openssl (required for Prisma build detection)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 1. Copy package files and configs for caching
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/types/package.json ./packages/types/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/common/package.json ./packages/common/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# 2. Install dependencies
RUN npm install

# 3. Copy source and Prisma schema
COPY packages/ ./packages/
COPY frontend/ ./frontend/
COPY backend/prisma/ ./backend/prisma/

# 4. Generate Prisma and Build shared packages using Project References
WORKDIR /app/backend
RUN npx prisma@6 generate
WORKDIR /app
RUN npx tsc --build

# 5. Build the frontend
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
