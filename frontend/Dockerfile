# frontend/Dockerfile
FROM node:20-slim AS build
WORKDIR /app

# 1. Install openssl
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 2. Copy Root Configs
COPY package*.json tsconfig*.json ./

# 3. Copy ALL package.json files
COPY packages/types/package.json ./packages/types/
COPY packages/schemas/package.json ./packages/schemas/
COPY packages/common/package.json ./packages/common/
COPY frontend/package.json ./frontend/
COPY backend/package.json ./backend/

# 4. Install Dependencies
RUN npm install

# 5. Copy Prisma Schema & Generate
COPY backend/prisma ./backend/prisma/
WORKDIR /app/backend
RUN npx prisma@6 generate

# 6. Copy ALL Source Code
WORKDIR /app
COPY . .

# 7. Build everything using Project References
RUN npx tsc -b

# 8. Build the frontend specifically
WORKDIR /app/frontend
RUN npm run build

# 9. Serve stage with Nginx
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
