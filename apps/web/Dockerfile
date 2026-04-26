# syntax=docker/dockerfile:1.7

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN apk add --no-cache libc6-compat && corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @amdox/web build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/apps/web/.next /app/.next
COPY --from=build /app/apps/web/app /app/app
COPY --from=build /app/apps/web/package.json /app/package.json
COPY --from=build /app/apps/web/next-env.d.ts /app/next-env.d.ts
COPY --from=build /app/apps/web/tsconfig.json /app/tsconfig.json
COPY --from=build /app/apps/web/node_modules /app/node_modules
RUN addgroup -S nextjs && adduser -S nextjs -G nextjs
USER nextjs
EXPOSE 3000
CMD ["node_modules/.bin/next", "start", "--hostname", "0.0.0.0"]

