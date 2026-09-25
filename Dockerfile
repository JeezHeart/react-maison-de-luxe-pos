# ---- Stage 1: build the React app ----
FROM node:20-alpine AS build

WORKDIR /app

# Install dependencies first (better layer caching when only source changes)
COPY package.json package-lock.json ./
RUN npm ci

# Copy the source and build the production bundle
COPY . .
RUN npm run build

# ---- Stage 2: serve the static bundle with nginx ----
FROM nginx:1.27-alpine

# SPA fallback + asset caching (see nginx.conf)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# The whole Vite output (HTML, JS/CSS, public images) lives in /app/dist
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]