---
phase: 01
wave: 1
depends_on: []
files_modified:
  [
    "package.json",
    "pnpm-workspace.yaml",
    "turbo.json",
    "tsconfig.json",
    ".eslintrc.js",
    "docker-compose.yml",
    ".env.example",
    ".husky/pre-commit",
  ]
autonomous: true
---

# Phase 01 — Execution Plan

## 1. Goal

Establish the Turborepo monorepo, code quality toolchain, and Docker Compose development stack so all subsequent phases have a consistent foundation.

## 2. Requirements Covered

- ENV-01: Developer can scaffold the complete Turborepo monorepo with apps/web, apps/api, apps/ml-service, packages/ui, packages/db, packages/types, packages/config
- ENV-02: ESLint, Prettier, Husky pre-commit hooks, commitlint, and lint-staged are configured and enforced
- ENV-03: Docker Compose dev stack runs PostgreSQL (TimescaleDB), Redis, Keycloak, Elasticsearch, and Mailpit with health checks
- ENV-04: .env.example documents all required environment variables with descriptions

## 3. Tasks

<task id="01-01-01" priority="high">
<description>Scaffold Turborepo monorepo structure and move legacy code</description>
<read_first>
- c:/Users/91892/project/.planning/phases/01-environment-setup-monorepo-scaffold/01-CONTEXT.md
- c:/Users/91892/project/package.json
</read_first>
<action>
1. Create a `legacy/` directory at the root.
2. Move existing `frontend/` and `backend/` directories directly into `legacy/`.
3. Initialize a base `package.json` at the root with `pnpm` workspaces enabled and `turbo` as a devDependency.
4. Create `pnpm-workspace.yaml` containing the `apps/*` and `packages/*` patterns.
5. Create directories for `apps/web/`, `apps/api/`, `apps/ml-service/`, `packages/ui/`, `packages/db/`, `packages/types/`, `packages/config/`.
6. Create an initial `package.json` inside each created app/package directory setting its name to `@amdox/<dir-name>`.
7. Create `turbo.json` at root defining build, dev, lint, and typecheck pipelines ensuring `build` dependsOn `^build`.
</action>
<acceptance_criteria>
- Directory `legacy/frontend` and `legacy/backend` exists.
- File `pnpm-workspace.yaml` exists containing `packages:`.
- Root `package.json` tracks project workspaces.
- `turbo.json` exists specifying `pipeline` configurations.
</acceptance_criteria>
</task>

<task id="01-01-02" priority="high">
<description>Configure Shared Code Quality Tooling (ESLint, Prettier, TypeScript, Husky)</description>
<read_first>
- Root `package.json`
- `packages/config/package.json`
</read_first>
<action>
1. In `packages/config/`, initialize base `tsconfig.json` enabling `"strict": true`.
2. Add base `.eslintrc.js` in `packages/config/` with standard recommended rules for TS.
3. In root `package.json`, install code quality tools `eslint`, `prettier`, `husky`, `lint-staged`, `@commitlint/config-conventional` and `@commitlint/cli` via `pnpm add -D -w`.
4. Run `pnpm exec husky init` to setup `.husky`.
5. Configure `.lintstagedrc` (or inline config) to run ESLint and Prettier on `*.{ts,tsx}`.
6. Configure `.husky/pre-commit` to execute `pnpm exec lint-staged`.
7. Configure `.husky/commit-msg` to execute `pnpm exec commitlint --edit "${1}"`.
8. Create `commitlint.config.js` to extend `@commitlint/config-conventional`.
</action>
<acceptance_criteria>
- `packages/config/tsconfig.json` exists detailing `{"strict": true}`.
- Lint scripts successfully bind across workspaces.
- `.husky/pre-commit` explicitly calls lint-staged.
</acceptance_criteria>
</task>

<task id="01-01-03" priority="high">
<description>Configure Docker Compose Backend Infrastructure Services</description>
<read_first>
- c:/Users/91892/project/.planning/phases/01-environment-setup-monorepo-scaffold/01-RESEARCH.md
</read_first>
<action>
1. Create `docker-compose.yml` at project root.
2. Define a service for `timescaledb` utilizing image `timescale/timescaledb:latest-pg17` mapping port `5432`.
3. Define a service for `redis` utilizing image `redis:8` mapping port `6379`.
4. Define a service for `keycloak` utilizing image `quay.io/keycloak/keycloak:25.0` starting Keycloak (e.g. `start-dev`), map port `8080`, define postgres link matching TimescaleDB credentials.
5. Define a service for `elasticsearch` utilizing image `docker.elastic.co/elasticsearch/elasticsearch:8.15.0` configured for single-node mode, mapping port `9200`.
6. Define a service for `mailpit` utilizing image `axllent/mailpit`, mapping port `1025` for SMTP and `8025` for UI.
7. Include fundamental `healthcheck` specifications for each service.
</action>
<acceptance_criteria>
- `docker-compose.yml` file is syntactically valid YAML.
- `timescaledb`, `redis`, `keycloak`, `elasticsearch`, `mailpit` services declared cleanly.
- Health checks are explicitly listed in YAML.
</acceptance_criteria>
</task>

<task id="01-01-04" priority="high">
<description>Create and document `.env.example`</description>
<read_first>
- `docker-compose.yml`
</read_first>
<action>
1. Create `.env.example` at root.
2. Outline application variables mapping to the `docker-compose.yml` infra:
   - `DATABASE_URL` (format: postgresql://)
   - `REDIS_URL` (format: redis://)
   - Keycloak SSO secrets (URL, Client ID, Client Secret)
   - Elasticsearch Node mappings
   - SMTP host tracking Mailpit (SMTP_HOST=localhost, SMTP_PORT=1025)
3. Incorporate adequate inline comments detailing where to find these parameters in Keycloak's dashboard initially.
</action>
<acceptance_criteria>
- `.env.example` exists.
- `DATABASE_URL=` exists indicating expected connection format.
- Code blocks are highly readable and devoid of hardcoded secrets.
</acceptance_criteria>
</task>

## 4. Threat Model & Security Validations

<threat_model>

- **Secrets Management:** The configuration enforces use of `.env.example` to ensure no active keys are hardcoded in the repository (fulfilling SEC specs down the line).
- **Access Control:** Keycloak abstracts authentication; Docker Compose provides testing grounds exclusively via local bindings to `127.0.0.1` reducing exposure surface.
- No production certificates or prod volumes are committed.
  </threat_model>

## 5. Verification

- Validate `pnpm install` works natively connecting the workspaces.
- Run `docker compose config -q` validating the stack representation.
- Ensure Husky correctly intercepts problematic code modifications on simulated commits.
