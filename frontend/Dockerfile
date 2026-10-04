# ── Frontend Dockerfile (multi-stage) ───────────────────────────────

# Stage 1: Build the React app
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

# VITE_API_URL is injected at build time via --build-arg
ARG VITE_API_URL=http://localhost:3001
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Serve with Nginx
 FROM nginx:alpine

#   Copy built files to nginx web root
 COPY --from=builder /app/dist /usr/share/nginx/html

# # Custom nginx config to handle React Router (SPA routing)
 COPY nginx.conf /etc/nginx/conf.d/default.conf

 EXPOSE 80

 CMD ["nginx", "-g", "daemon off;"]
