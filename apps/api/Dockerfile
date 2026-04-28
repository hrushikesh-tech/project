# syntax=docker/dockerfile:1.7

FROM node:20-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @amdox/api... build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV PORT_API=3001
ENV CORS_ORIGIN=http://localhost:3000
ENV CLUSTER_WORKERS=1
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api/dist /app/apps/api/dist
COPY --from=build /app/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build /app/apps/api/package.json /app/apps/api/package.json
COPY --from=build /app/packages/config /app/packages/config
COPY --from=build /app/packages/db /app/packages/db
COPY --from=build /app/packages/db/node_modules /app/packages/db/node_modules
COPY --from=build /app/packages/types /app/packages/types
CMD ["node", "dist/src/main.js"]

