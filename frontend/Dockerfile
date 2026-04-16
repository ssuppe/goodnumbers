# frontend/Dockerfile
FROM node:20-slim AS build
WORKDIR /app

# Install openssl (required for Prisma build detection)
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copy root package files and configs
COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/ ./packages/
COPY frontend/ ./frontend/
COPY backend/prisma/ ./backend/prisma/
COPY backend/package.json ./backend/package.json 

# Install dependencies
RUN npm install

# Generate Prisma client (required for types)
WORKDIR /app/backend
RUN npx prisma@6 generate

# Build shared packages sequentially to ensure type resolution
WORKDIR /app/packages/types
RUN npm run build
WORKDIR /app/packages/schemas
RUN npm run build
WORKDIR /app/packages/common
RUN npm run build

# Build the frontend
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
