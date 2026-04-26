---
phase: 17
validation_type: phase_plan
status: draft
created_at: 2026-04-27
nyquist_compliant: true
wave_0_complete: true
---

# Phase 17 Validation - CI/CD Pipeline

## Validation Scope

This validation plan covers planning completeness and execution-time evidence for the GitHub Actions CI workflow, GitOps promotion workflow, security gates, and bounded staging smoke gate in Phase 17.

## Requirements Coverage

| Requirement | Covered By                         | Validation Notes                                                                                                                                                  |
| ----------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CICD-01`   | `17-01`, `17-02`, `17-03`, `17-04` | The release-contract foundation, PR CI workflow, GitOps promotion workflow, and staging smoke gate together cover the full validation-through-promotion pipeline. |
| `CICD-02`   | `17-01`, `17-02`                   | Trufflehog reuse, workflow gating, and truthful secrets-scan command wiring are introduced before deployment work proceeds.                                       |
| `CICD-03`   | `17-01`, `17-02`                   | Checked-in Snyk and Trivy exception policy plus workflow fail-on-HIGH/CRITICAL enforcement are established in the foundation and CI waves.                        |
| `CICD-04`   | `17-03`, `17-04`                   | Production approval through GitHub Environments and the post-staging smoke gate are both required before prod promotion can complete.                             |

## Task Traceability

| Task ID    | Validation Target                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `17-01-01` | Helm values overlays can pin environment-specific immutable image tags rather than relying on mutable defaults.                |
| `17-01-02` | The release helper script can rewrite staging and production values files safely and predictably in dry-run mode.              |
| `17-01-03` | Checked-in `.snyk` and `.trivyignore.yaml` policy files exist and document explicit reviewed exceptions.                       |
| `17-01-04` | Root phase-17 verification scripts and dry-run checks exist before workflow wiring begins.                                     |
| `17-02-01` | `ci.yml` triggers on the intended repo events with least-privilege defaults and no deploy-only secrets.                        |
| `17-02-02` | CI jobs cover lint, typecheck, unit, integration, security, E2E, and build using real repo commands.                           |
| `17-02-03` | Trufflehog, Snyk, and Trivy each fail CI with the intended severity and exception behavior.                                    |
| `17-02-04` | The local command set or recorded blockers truthfully matches what CI expects to run.                                          |
| `17-03-01` | `deploy.yml` triggers only from trusted successful `main` CI runs and uses deploy-safe permissions and concurrency.            |
| `17-03-02` | The deploy workflow builds and publishes one immutable artifact set for all services.                                          |
| `17-03-03` | Staging promotion updates repo-managed Helm values rather than calling the cluster directly.                                   |
| `17-03-04` | Production approval and prod promotion use the same staging-proven tags without rebuilding.                                    |
| `17-04-01` | The API-side staging smoke proves health, login, protected access, and logout semantics against the deployed staging base URL. |
| `17-04-02` | The browser-side staging smoke proves one protected release route on the real staging host.                                    |
| `17-04-03` | Production approval in `deploy.yml` remains unreachable until the staging smoke passes.                                        |
| `17-04-04` | Operator-facing docs and reproduction commands match the final workflow and smoke behavior truthfully.                         |

## Wave 0 Requirements

- [x] `.planning/phases/17-ci-cd-pipeline/17-RESEARCH.md` - research-backed implementation direction before planning
- [x] `.planning/phases/17-ci-cd-pipeline/17-VALIDATION.md` - the phase validation contract itself
- [ ] `.github/workflows/ci.yml` - PR and `main` validation workflow
- [ ] `.github/workflows/deploy.yml` - trusted promotion workflow
- [ ] `scripts/release/update-image-tags.mjs` - GitOps values-update helper used by promotion
- [ ] `.snyk` - checked-in reviewed exception policy
- [ ] `.trivyignore.yaml` - checked-in reviewed exception policy

## Verification Contract

### Planned Command Evidence

- `pnpm lint`
- `pnpm typecheck`
- `pnpm --filter @amdox/api run test:unit`
- `pnpm --filter @amdox/api run test:integration`
- `pnpm --filter @amdox/web run test:unit`
- `pnpm --filter @amdox/web run test:e2e`
- `pnpm build`
- `pnpm security:secrets`
- `snyk test --severity-threshold=high`
- `trivy fs --exit-code 1 --severity HIGH,CRITICAL .`
- `node scripts/release/update-image-tags.mjs --file infra/helm/amdox/values-staging.yaml --set-tag test-sha --dry-run`
- `node scripts/release/update-image-tags.mjs --file infra/helm/amdox/values-prod.yaml --set-tag test-sha --dry-run`
- `PHASE15_SMOKE_BASE_URL=https://api.staging.amdox.example pnpm --filter @amdox/api run test:smoke`
- `PLAYWRIGHT_EXTERNAL_SERVER=1 PLAYWRIGHT_BASE_URL=https://web.staging.amdox.example pnpm --filter @amdox/web run test:e2e -- --grep "@staging-release"`
- `rg "workflow_run|environment: production|trivy|snyk|trufflehog|packages: write|contents: write" .github/workflows`

### Environment-Gated / Manual Verifications

| Behavior                                                  | Requirement           | Why Manual                                                                 | Test Instructions                                                                                                                          |
| --------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Production approval in GitHub Environments                | `CICD-04`             | Requires the real GitHub repo settings and reviewer policy, not just YAML. | Confirm the `production` environment has required reviewers and that the deploy workflow pauses there before the prod values update step.  |
| Repo write-back for promotion commits                     | `CICD-01` / `CICD-04` | Depends on the real bot or workflow token scope in GitHub.                 | Run the deploy flow in a non-prod branch or dry-run mode, verify the promotion helper can author and push the expected values-file commit. |
| Live ArgoCD sync after staging values update              | `CICD-01`             | Depends on the real cluster and ArgoCD controller being available.         | After a staging promotion commit, confirm the staging Application reconciles to the new image tags before smoke begins.                    |
| Live staging credentials and protected route availability | `CICD-01`             | Requires real staging URL, auth credentials, and seeded release data.      | Verify the staging smoke env vars resolve to working credentials and that the selected protected route can render after login.             |

## Exit Condition

Phase 17 is validation-complete when:

- release-contract helper files and checked-in security policy files exist
- CI workflow covers the full required PR and `main` validation path
- deploy workflow promotes through GitOps values updates and gates production with GitHub approval
- staging smoke blocks production until health, auth, protected API access, and one protected web route pass
- any remaining blocked item is an external environment or secret dependency, not a missing workflow or file contract
