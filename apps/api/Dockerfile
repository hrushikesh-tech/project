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
RUN pnpm deploy --filter=@amdox/api --prod /opt/api

FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT_API=3001
ENV CORS_ORIGIN=http://localhost:3000
ENV CLUSTER_WORKERS=1
COPY --from=build /opt/api /app
CMD ["dist/src/main.js"]

