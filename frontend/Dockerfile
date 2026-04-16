# frontend/Dockerfile
FROM node:20-slim AS build
WORKDIR /app

# 1. Install openssl
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# 2. Copy the entire pre-built source
COPY . .

# 3. Install dependencies
RUN npm install --omit=dev --legacy-peer-deps

# 4. Generate Prisma and Build the frontend
WORKDIR /app/backend
RUN npx prisma@6 generate
WORKDIR /app/frontend
RUN npm run build

# 5. Serve stage with Nginx
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
