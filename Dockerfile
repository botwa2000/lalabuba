# Lalabuba — production image (Hetzner / Docker Swarm)
FROM node:20-alpine

WORKDIR /app

# Install prod deps only (none currently required); stays correct if deps are added later.
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund || true

# App code (see .dockerignore for exclusions).
COPY . .
RUN chmod +x /app/docker-entrypoint.sh

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

EXPOSE 3000

# Run as the unprivileged built-in node user.
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health >/dev/null 2>&1 || exit 1

ENTRYPOINT ["/app/docker-entrypoint.sh"]
