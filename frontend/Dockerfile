# frontend/Dockerfile
FROM node:20-slim AS build
WORKDIR /app

# 1. Install system deps
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

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

# 5. Generate Prisma and Build the frontend
WORKDIR /app/backend
RUN npx prisma@6 generate
WORKDIR /app/frontend
RUN npm run build

# 6. Serve stage with Nginx
FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
RUN echo 'server { \
    listen 80; \
    location / { \
        root /usr/share/nginx/html; \
        try_files $uri $uri/ /index.html; \
    } \
}' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
