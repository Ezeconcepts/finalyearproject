# ── Backend Dockerfile ──────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# Create required upload directories
RUN mkdir -p public/uploads-temp public/encrypted-temp public/cloud

EXPOSE 3001

CMD ["node", "server.js"]
