# Build from the repository root:
#   docker build -f infra/api.Dockerfile -t sharebasket-api .
# The API is deployed with PostgreSQL; SQLite is only for local development.

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NPM_CONFIG_FUND=false NPM_CONFIG_AUDIT=false

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --workspace @sharebasket/api --include-workspace-root

FROM deps AS build
COPY apps/api apps/api
RUN npm run build -w apps/api

FROM base AS runtime
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci --omit=dev --workspace @sharebasket/api --include-workspace-root \
  && npm cache clean --force
COPY --from=build /app/apps/api/dist apps/api/dist

WORKDIR /app/apps/api
RUN mkdir -p data && chown -R node:node /app
USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Render and Compose provide PORT; migrations/seed run when their env flags are set.
CMD ["node", "dist/main.js"]
