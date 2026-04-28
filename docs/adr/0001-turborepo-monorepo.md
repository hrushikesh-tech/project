# ADR 0001: Use a Turborepo Workspace Monorepo

**Status:** Accepted
**Date:** 2026-04-28

## Context

The repo already contains a web app, API, ML service, shared packages, and platform assets that need to evolve together. The product also depends on shared contracts such as types, environment variables, deployment overlays, telemetry names, and API behavior.

## Decision

Use a single pnpm workspace managed through Turborepo for the application and platform code.

## Consequences

- shared changes can be made atomically
- build, lint, and typecheck commands can fan out from the root
- app-specific scripts remain available when a narrower loop is needed
- the repo needs discipline around package boundaries so the monorepo does not become a dumping ground

## Implementation Notes

- `package.json` defines workspace-level build, lint, typecheck, security, and verification entrypoints
- app packages keep their own `dev`, `build`, and test scripts
- documentation, observability, and infrastructure assets live beside the application code so they can be versioned together
