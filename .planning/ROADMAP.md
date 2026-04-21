# Roadmap: Amdox AI-Powered Cloud ERP Suite

**Milestone:** v1.0
**Phases:** 18
**Requirements:** 122
**Granularity:** Fine

## Phases

### Phase 1: Environment Setup & Monorepo Scaffold [COMPLETED]

**Goal:** Establish the Turborepo monorepo, code quality toolchain, and Docker Compose development stack so all subsequent phases have a consistent foundation.
**Requirements:** ENV-01, ENV-02, ENV-03, ENV-04
**Depends on:** (none)
**UI hint:** no

**Success criteria:**

1. `pnpm install` and `pnpm build` succeed across all workspace packages
2. Pre-commit hooks run ESLint, Prettier, type-check on staged files
3. `docker compose up` brings up TimescaleDB, Redis, Keycloak, Elasticsearch, Mailpit with healthy status
4. `.env.example` lists every required env var with descriptions

---

### Phase 2: Database Schema & Authentication [COMPLETED]

**Goal:** Define the complete Prisma schema with 40+ models, tenant middleware, and a fully working Keycloak-based auth flow in NestJS with RBAC, MFA, and audit logging.
**Requirements:** DB-01, DB-02, DB-03, DB-04, DB-05, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10
**Depends on:** Phase 1
**UI hint:** no

**Success criteria:**

1. `prisma migrate dev` applies schema with all models, indexes, and hypertables
2. Tenant middleware blocks queries without tenantId (verified by test)
3. Keycloak realm import succeeds with all roles, MFA policies, and client configs
4. POST /auth/login returns valid JWT; POST /auth/logout blacklists token in Redis
5. AuditInterceptor logs mutations with before/after snapshots to AuditLog table

---

### Phase 3: General Ledger (Finance Core) [COMPLETED]

**Goal:** Implement double-entry General Ledger with chart of accounts, journal entries, period close, multi-currency FX, and financial statements.
**Requirements:** FIN-01, FIN-02, FIN-03, FIN-04, FIN-05, FIN-06, FIN-07, FIN-08
**Depends on:** Phase 2
**UI hint:** no

**Success criteria:**

1. Creating an unbalanced journal entry throws UnbalancedEntryException
2. Posting to a closed period throws PeriodClosedException
3. Trial balance, balance sheet, and income statement queries return correct values for seeded GL data
4. FX rates are fetched, cached in Redis for 24h, and stored in FxRate table
5. All monetary values are stored as integers (cents)

---

### Phase 4: AP/AR Automation [COMPLETED]

**Goal:** Build invoice OCR pipeline, 3-way matching engine, and aging reports for accounts payable and receivable.
**Requirements:** APAR-01, APAR-02, APAR-03, APAR-04, APAR-05, APAR-06
**Depends on:** Phase 3
**UI hint:** no

**Success criteria:**

1. Uploading a PDF invoice triggers BullMQ OCR worker and creates draft Invoice record
2. 3-way match auto-approves and posts GL entry when all conditions met
3. Mismatches flag invoice for review and notify AP team
4. Aging report returns correct current/30/60/over-60 bucket amounts

---

### Phase 5: HR Core [COMPLETED]

**Goal:** Implement employee management, org chart, department hierarchy, leave management state machine, leave accrual, and attendance tracking.
**Requirements:** HR-01, HR-02, HR-03, HR-04, HR-05, HR-06, HR-07
**Depends on:** Phase 2
**UI hint:** no

**Success criteria:**

1. Recursive CTE org chart query returns full hierarchy with correct depth
2. Leave state machine transitions work: DRAFT→PENDING→APPROVED (deducts balance), PENDING→REJECTED (notifies), APPROVED→CANCELLED (restores balance if ≥48h before start)
3. Nightly accrual job correctly calculates and caps leave balances
4. Auto-cancel fires for PENDING requests past start date

---

### Phase 6: Payroll Engine [COMPLETED]

**Goal:** Build configurable gross-to-net payroll engine with India tax slabs, BullMQ saga processing, payslip PDF generation, and GL integration.
**Requirements:** PAY-01, PAY-02, PAY-03, PAY-04, PAY-05, PAY-06
**Depends on:** Phase 3, Phase 5
**UI hint:** no

**Success criteria:**

1. India tax calculation matches government tables for 5 test salary scenarios
2. Payroll run saga processes employees in batches of 100, generates payslips, posts GL entries
3. Failure triggers compensation: reverses partial GL postings, marks run as FAILED, alerts admin
4. Payslip PDFs are generated and stored in S3
5. 10,000 employee batch completes in < 5 minutes

---

### Phase 7: Supply Chain & Inventory [COMPLETED]

**Goal:** Implement vendor management, PO lifecycle, reorder automation, FIFO costing, goods receipt, and inventory management.
**Requirements:** SC-01, SC-02, SC-03, SC-04, SC-05, SC-06
**Depends on:** Phase 3
**UI hint:** no

**Success criteria:**

1. PO state machine transitions follow defined lifecycle with rejection → DRAFT loop
2. Reorder cron creates draft PO when stock ≤ reorderPoint and no pending PO exists
3. FIFO costing consumes from oldest cost layers; throws InsufficientStockException when depleted
4. Goods receipt updates PO line received quantities and inventory levels

---

### Phase 8: AI/ML Demand Forecasting [COMPLETED]

**Goal:** Build Python FastAPI ML microservice with Prophet and LSTM models, MAPE quality gating, and weekly automated retraining.
**Requirements:** ML-01, ML-02, ML-03, ML-04, ML-05
**Depends on:** Phase 7
**UI hint:** no

**Success criteria:**

1. Prophet model trains on historical data, removes outliers via IQR, returns MAPE < 20%
2. LSTM model trains only for SKUs with ≥ 500 data points with early stopping
3. POST /ml/predict returns forecast with confidence intervals; rejects models with MAPE > 20%
4. Weekly retraining compares new vs old MAPE and promotes only if improved
5. Health endpoint reports model count and last training time

---

### Phase 9: Business Intelligence Dashboard [COMPLETED]

**Goal:** Implement dashboard builder backend with widget configuration, 8 pre-built metrics, SSE real-time refresh, and scheduled report generation.
**Requirements:** BI-01, BI-02, BI-03, BI-04, BI-05
**Depends on:** Phase 3, Phase 5, Phase 7, Phase 8
**UI hint:** no

**Success criteria:**

1. Dashboard CRUD works with widget positions and sizes stored as JSON
2. All 8 pre-built metrics return correct aggregated data
3. SSE endpoint streams dashboard updates every 30 seconds
4. Scheduled report generates PDF/Excel and emails download link

---

### Phase 10: Project Management

**Goal:** Implement project CRUD, DAG-validated task dependencies, budget overrun alerting, resource utilization tracking, and milestone management.
**Requirements:** PM-01, PM-02, PM-03, PM-04, PM-05
**Depends on:** Phase 3, Phase 5
**UI hint:** no

**Success criteria:**

1. Circular dependency detection throws CircularDependencyException
2. Budget overrun notification fires when actualCost exceeds budget by ≥ 10%
3. Resource utilization query returns correct allocated vs available hours
4. Milestone status updates when all linked tasks complete

---

### Phase 11: Notification & Event Engine

**Goal:** Implement outbox pattern for guaranteed event delivery, 4 notification channels, webhook HMAC signing, templates, and user preferences.
**Requirements:** NOTIF-01, NOTIF-02, NOTIF-03, NOTIF-04, NOTIF-05, NOTIF-06
**Depends on:** Phase 2
**UI hint:** no

**Success criteria:**

1. Events written in same DB transaction are reliably picked up by outbox worker within 5 seconds
2. In-app, email, and webhook channels deliver notifications for test events
3. Webhook signatures verify correctly with timing-safe comparison
4. User can configure per-event, per-channel notification preferences

---

### Phase 12: Frontend (Next.js 15)

**Goal:** Build the complete Next.js 15 frontend with all module UIs, data tables, forms, charts, dashboard builder, Gantt chart, PWA support, and WCAG 2.1 AA accessibility.
**Requirements:** UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10, UI-11, UI-12
**Depends on:** Phase 3, Phase 4, Phase 5, Phase 6, Phase 7, Phase 8, Phase 9, Phase 10, Phase 11
**UI hint:** yes

**Success criteria:**

1. Login flow works with Keycloak OIDC, auto-refresh, and middleware protection
2. All data tables have sorting, filtering, search, pagination, export, loading/empty/error states
3. Journal entry form shows real-time debit/credit balance indicator
4. D3.js Gantt chart renders 500 tasks in < 1 second with dependency arrows
5. Dashboard builder supports drag-and-drop widget placement with live preview
6. Lighthouse score ≥ 90 on Performance, Accessibility, Best Practices
7. Service worker caches core routes and queues offline mutations

---

### Phase 13: API Gateway, GraphQL & Webhooks

**Goal:** Standardize REST API with OpenAPI 3.1, response envelopes, versioning, and add GraphQL layer for BI aggregation queries.
**Requirements:** API-01, API-02, API-03, API-04, API-05
**Depends on:** Phase 9
**UI hint:** no

**Success criteria:**

1. Swagger UI at /api-docs shows all endpoints with full documentation
2. All responses follow standard envelope format with requestId and pagination meta
3. GraphQL BI queries work with DataLoader preventing N+1
4. Introspection disabled in production; depth limit and complexity limit enforced

---

### Phase 14: Security Hardening

**Goal:** Apply comprehensive security controls across all layers: JWT hardening, input validation, CSP headers, rate limiting, IDOR prevention, secrets scanning.
**Requirements:** SEC-01, SEC-02, SEC-03, SEC-04, SEC-05, SEC-06, SEC-07, SEC-08, SEC-09
**Depends on:** Phase 12, Phase 13
**UI hint:** no

**Success criteria:**

1. JWT uses RS256 with 15-min expiry; refresh token rotates on use
2. class-validator enforced on all DTOs; Zod on all frontend forms
3. Rate limiting returns 429 at configured thresholds
4. Cross-tenant access test returns 403 for every module endpoint
5. trufflehog scan finds zero committed secrets

---

### Phase 15: Testing Strategy

**Goal:** Achieve ≥80% unit coverage, write integration tests for all endpoints, implement 8 E2E journeys, create test utilities, and run k6 load tests.
**Requirements:** TEST-01, TEST-02, TEST-03, TEST-04, TEST-05
**Depends on:** Phase 14
**UI hint:** no

**Success criteria:**

1. `pnpm test:unit --coverage` reports ≥ 80% line coverage on all services
2. Every API endpoint has at least one happy-path and one error-path integration test
3. All 8 Playwright E2E journeys pass
4. k6 load test sustains 2,000 concurrent users with P95 < 300ms and error rate < 1%

---

### Phase 16: Containerization & Kubernetes

**Goal:** Create production Docker images, Helm chart with all K8s resources, Istio canary config, and ArgoCD GitOps manifests.
**Requirements:** K8S-01, K8S-02, K8S-03, K8S-04
**Depends on:** Phase 15
**UI hint:** no

**Success criteria:**

1. Docker images build as multi-stage, run as non-root, have no shell (distroless for API)
2. Helm chart deploys all services with HPA, PDB, NetworkPolicy, and TLS ingress
3. Istio VirtualService routes 90% stable / 10% canary
4. ArgoCD syncs with self-heal and prune enabled

---

### Phase 17: CI/CD Pipeline

**Goal:** Build complete GitHub Actions pipeline with lint, test, security scan, build, and staged deployment (staging → production with manual approval).
**Requirements:** CICD-01, CICD-02, CICD-03, CICD-04
**Depends on:** Phase 16
**UI hint:** no

**Success criteria:**

1. Full pipeline runs on PR: lint → typecheck → unit tests → integration → security → E2E
2. trufflehog and snyk/trivy scans block PRs with HIGH/CRITICAL findings
3. Main branch auto-deploys to staging; production requires manual approval
4. Smoke tests pass on staging before production is available

---

### Phase 18: Observability, Cloud, GDPR & Documentation

**Goal:** Instrument OpenTelemetry + Prometheus + Grafana, deploy AWS infrastructure via Terraform, implement GDPR compliance, and write comprehensive documentation.
**Requirements:** OBS-01, OBS-02, OBS-03, OBS-04, CLOUD-01, CLOUD-02, CLOUD-03, GDPR-01, GDPR-02, GDPR-03, GDPR-04, DOCS-01, DOCS-02, DOCS-03
**Depends on:** Phase 17
**UI hint:** no

**Success criteria:**

1. OpenTelemetry SDK exports traces and custom business metrics to Prometheus
2. 3 Grafana dashboards show API performance, business metrics, and infrastructure
3. Prometheus alerts fire for P95 > 300ms, error rate > 1%, MAPE > 20%
4. Terraform provisions EKS, Aurora, ElastiCache, S3, WAF
5. GDPR data export returns encrypted JSON; erasure pseudonymises PII within 72h
6. README includes architecture diagram, setup instructions, env vars reference
7. 6 ADRs document key architectural decisions
8. OpenAPI 3.1 spec published with full endpoint documentation

---

## Coverage

| Phase     | Requirements                                       | Count   |
| --------- | -------------------------------------------------- | ------- |
| 1         | ENV-01..04                                         | 4       |
| 2         | DB-01..05, AUTH-01..10                             | 15      |
| 3         | FIN-01..08                                         | 8       |
| 4         | APAR-01..06                                        | 6       |
| 5         | HR-01..07                                          | 7       |
| 6         | PAY-01..06                                         | 6       |
| 7         | SC-01..06                                          | 6       |
| 8         | ML-01..05                                          | 5       |
| 9         | BI-01..05                                          | 5       |
| 10        | PM-01..05                                          | 5       |
| 11        | NOTIF-01..06                                       | 6       |
| 12        | UI-01..12                                          | 12      |
| 13        | API-01..05                                         | 5       |
| 14        | SEC-01..09                                         | 9       |
| 15        | TEST-01..05                                        | 5       |
| 16        | K8S-01..04                                         | 4       |
| 17        | CICD-01..04                                        | 4       |
| 18        | OBS-01..04, CLOUD-01..03, GDPR-01..04, DOCS-01..03 | 14      |
| **Total** |                                                    | **122** |

**Unmapped:** 0 ✓

---

_Roadmap created: 2026-04-09_
