# Phase 1: Environment Setup & Monorepo Scaffold - Technical Research

**Objective:** Define the concrete architecture to scaffold the Turborepo monorepo, configure the CI/quality toolchain, and set up the local Docker Compose backend.

## 1. Turborepo Monorepo Architecture

**Workspace Structure:**

```text
/
├── apps/
│   ├── web/           (Next.js 15)
│   ├── api/           (NestJS 11)
│   └── ml-service/    (FastAPI)
├── packages/
│   ├── ui/            (shadcn/ui + Tailwind)
│   ├── db/            (Prisma schema + TimescaleDB integration)
│   ├── types/         (Shared TS interfaces, DTOs)
│   └── config/        (Shared eslint, tsconfig, prettier)
├── legacy/            (Moved from old frontend/backend to preserve reference)
├── turbo.json         (Pipeline definitions)
└── pnpm-workspace.yaml
```

**Key `turbo.json` Pipeline Config:**

- `build`: `dependsOn: ["^build"]`
- `dev`: `cache: false`, `persistent: true`
- `lint`: `dependsOn: ["^build"]`
- `typecheck`: `dependsOn: ["^build"]`

## 2. Docker Compose Dev Stack

Required Services for Local Dev (`docker-compose.yml` at root):

- **TimescaleDB:** `timescale/timescaledb:latest-pg17` (Postgres 17 baseline needed per PROJECT.md)
  - Port: `5432:5432`
- **Redis:** `redis:8`
  - Port: `6379:6379`
- **Keycloak:** `quay.io/keycloak/keycloak:25.0`
  - Port: `8080:8080` (admin access needed)
  - Config: `KC_DB=postgres`, linking back to Timescale service.
- **Elasticsearch:** `docker.elastic.co/elasticsearch/elasticsearch:8.15.0`
  - Port: `9200:9200` (disabling xpack.security.enabled for local if needed, or configuring single-node)
- **Mailpit:** `axllent/mailpit` (replaces MailHog for SMTP testing)
  - Port: `1025:1025` (SMTP), `8025:8025` (UI)

_No application services (web/api/ml) in Docker Compose; these run natively via `pnpm dev` for proper hot reloading._

## 3. Code Quality Toolchain

- **TypeScript:** Strict mode enabled `("strict": true)` in base `tsconfig.json`.
- **ESLint/Prettier:** Shared `eslint-config` workspace package based on recommended Next.js / NestJS defaults, wired with Prettier.
- **Husky & Lint-Staged:** `pre-commit` hook to run `lint-staged` with `eslint --fix` and `prettier --write` for `*.ts(x)`. Commits validated via `commitlint` for Conventional Commits.

## Validation Architecture

To ensure the environment scaffold succeeds without false positives:

1. **Monorepo Build Integrity:**
   - Ensure `pnpm run build` exits `0` across all workspace packages via Turborepo.
2. **Quality Tooling Affirmation:**
   - Pre-commit hook must be executable and trap formatting errors.
3. **Container Health Checks:**
   - All defined containers in `docker-compose.yml` must report `healthy` via Docker daemon (`docker compose ps`).
4. **Environment Transparency:**
   - `.env.example` must contain every referenced environment variable for DB, Redis, Keycloak, Elastic, and Mailpit.
