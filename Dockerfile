# syntax=docker/dockerfile:1.7

# ---- builder ----
FROM node:20-alpine AS builder
WORKDIR /app

# Install deps (including dev) for the build step.
COPY package.json package-lock.json* ./
RUN npm ci

# Compile TS → dist/ with tsup.
COPY tsconfig.json tsup.config.ts ./
COPY src ./src
RUN npm run build

# Prune dev dependencies for the runtime image.
RUN npm prune --omit=dev

# ---- runtime ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    MCP_TRANSPORT=http \
    PORT=3000

# Non-root user for the running process.
RUN addgroup -S zoe && adduser -S zoe -G zoe

COPY --from=builder --chown=zoe:zoe /app/node_modules ./node_modules
COPY --from=builder --chown=zoe:zoe /app/dist ./dist
COPY --chown=zoe:zoe package.json ./
COPY --chown=zoe:zoe data ./data

USER zoe
EXPOSE 3000

# Simple health probe that exits non-zero if /healthz is not reachable.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
