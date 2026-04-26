# Requirements: Amdox AI-Powered Cloud ERP Suite

**Defined:** 2026-04-09
**Core Value:** Every financial transaction is accurately recorded, balanced, and auditable — the General Ledger is the foundation that every other module depends on.

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Environment & Toolchain (ENV)

- [ ] **ENV-01**: Developer can scaffold the complete Turborepo monorepo with apps/web, apps/api, apps/ml-service, packages/ui, packages/db, packages/types, packages/config
- [ ] **ENV-02**: ESLint, Prettier, Husky pre-commit hooks, commitlint, and lint-staged are configured and enforced
- [ ] **ENV-03**: Docker Compose dev stack runs PostgreSQL (TimescaleDB), Redis, Keycloak, Elasticsearch, and Mailpit with health checks
- [ ] **ENV-04**: .env.example documents all required environment variables with descriptions

### Database & Schema (DB)

- [ ] **DB-01**: Prisma schema defines all 40+ models with id, createdAt, updatedAt, deletedAt (soft delete), and tenantId
- [ ] **DB-02**: Every tenantId and foreign key column is indexed; composite indexes on (tenantId, status) for workflow tables
- [ ] **DB-03**: TimescaleDB hypertables configured on AuditLog(timestamp) and ForecastPrediction(forecastDate)
- [ ] **DB-04**: Prisma tenant middleware automatically injects WHERE tenantId = :currentTenantId into every query
- [ ] **DB-05**: Tenant middleware throws error if tenantId is missing from context (impossible to bypass for non-SuperAdmin)

### Authentication & Authorization (AUTH)

- [ ] **AUTH-01**: Keycloak realm configured with OIDC clients (amdox-web public PKCE, amdox-api confidential)
- [ ] **AUTH-02**: Seven realm roles defined: super_admin, tenant_admin, finance_manager, hr_manager, supply_chain_manager, project_manager, viewer
- [ ] **AUTH-03**: Password policy enforces minimum 12 chars with uppercase, lowercase, digits, special chars
- [ ] **AUTH-04**: Brute force detection locks account after 5 failed attempts for 30 minutes
- [ ] **AUTH-05**: MFA required for super_admin and tenant_admin roles (TOTP, 6 digits, 30s period)
- [ ] **AUTH-06**: NestJS JwtStrategy validates RS256 JWT from Keycloak extracting sub, email, roles, tenant_id
- [ ] **AUTH-07**: RolesGuard provides decorator-based RBAC via @Roles()
- [ ] **AUTH-08**: TenantGuard injects tenantId from JWT into every request context
- [ ] **AUTH-09**: AuditInterceptor logs every mutation (POST/PUT/PATCH/DELETE) with before/after snapshots to AuditLog
- [ ] **AUTH-10**: Auth endpoints: login, refresh, logout (with Redis token blacklist), verify-mfa, me

### Finance — General Ledger (FIN)

- [ ] **FIN-01**: Chart of accounts with tree structure (parent-child), types: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
- [ ] **FIN-02**: Journal entries enforce SUM(debits) === SUM(credits) — throws UnbalancedEntryException if not
- [ ] **FIN-03**: Posted entries are immutable; reversal creates a mirror entry
- [ ] **FIN-04**: Period close locks all entries for that period — throws PeriodClosedException on attempts to post
- [ ] **FIN-05**: Multi-currency support with FX rates fetched daily from OpenExchangeRates, cached in Redis 24h
- [ ] **FIN-06**: All monetary values stored as integers (cents/paise) to avoid floating point errors
- [ ] **FIN-07**: Trial balance, balance sheet, and income statement reports generated from GL data
- [ ] **FIN-08**: Intercompany transfers generate mirror entries in both entities

### Finance — AP/AR (APAR)

- [ ] **APAR-01**: Invoice upload to S3 triggers BullMQ worker for OCR processing (AWS Textract or Tesseract fallback)
- [ ] **APAR-02**: OCR extracts vendor name, invoice number, date, line items, amounts, tax from PDF/image
- [ ] **APAR-03**: 3-way matching: Invoice ↔ PurchaseOrder ↔ GoodsReceipt by PO number, amounts within 1%, line item similarity ≥ 0.85
- [ ] **APAR-04**: Auto-approve and post GL entry when all 3-way match conditions met
- [ ] **APAR-05**: Flag for manual review and send notification to AP team when any match condition fails
- [ ] **APAR-06**: AP/AR aging report with current, 30-day, 60-day, and over-60-day buckets by vendor

### HR Core (HR)

- [ ] **HR-01**: Employee management with lifecycle: hire → active → terminated, linked to User and Department
- [ ] **HR-02**: Org chart via recursive CTE query showing full hierarchy with depth
- [ ] **HR-03**: Department tree structure with parent-child relationships and department heads
- [ ] **HR-04**: Leave management state machine: DRAFT → PENDING → APPROVED|REJECTED → CANCELLED
- [ ] **HR-05**: Leave balance accrual runs nightly via BullMQ cron using LeaveType.accrualRate
- [ ] **HR-06**: Auto-cancel leave requests if start date passes while still PENDING
- [ ] **HR-07**: Attendance tracking with clock in/out, hours worked, and overtime calculation

### Payroll (PAY)

- [ ] **PAY-01**: Gross-to-net calculation engine configurable per jurisdiction
- [ ] **PAY-02**: India tax regime (FY 2025-26): slabs from 0% to 30%, rebate u/s 87A, PF 12%, professional tax
- [ ] **PAY-03**: Payroll run as BullMQ saga: lock period → fetch employees → batch calculate → generate payslips → post GL → notify
- [ ] **PAY-04**: Payslip PDF generation via Puppeteer stored in S3
- [ ] **PAY-05**: Compensation pattern: on failure, reverse partial GL postings and alert payroll admin
- [ ] **PAY-06**: Process 10,000 employees in < 5 minutes

### Supply Chain (SC)

- [ ] **SC-01**: Vendor management with payment terms, currency, status tracking
- [ ] **SC-02**: PO lifecycle: DRAFT → SUBMITTED → APPROVED → SENT_TO_VENDOR → PARTIALLY_RECEIVED → FULLY_RECEIVED → CLOSED
- [ ] **SC-03**: Reorder automation runs every 6 hours: creates draft PO when currentStock ≤ reorderPoint
- [ ] **SC-04**: FIFO inventory costing: consume from oldest cost layers first
- [ ] **SC-05**: Goods receipt linked to PO with quantity tracking per line
- [ ] **SC-06**: InsufficientStockException thrown when consuming more than available

### ML Forecasting (ML)

- [ ] **ML-01**: Prophet model with multiplicative seasonality, IQR outlier removal, and MAPE quality gate (≤ 20%)
- [ ] **ML-02**: LSTM model for high-volume SKUs (≥ 500 data points) with 60-day lookback, early stopping
- [ ] **ML-03**: Weekly retraining via BullMQ cron: retrain → compare MAPE → promote if improved
- [ ] **ML-04**: FastAPI endpoints: train, predict, list models, model details, retrain-all, health
- [ ] **ML-05**: MAPE gate: never serve predictions from model with MAPE > 20%

### Business Intelligence (BI)

- [ ] **BI-01**: Dashboard CRUD with owner, title, public/private, linked widgets
- [ ] **BI-02**: Widget types: bar_chart, line_chart, pie_chart, kpi_card, table, heatmap, funnel
- [ ] **BI-03**: Real-time metric refresh via Server-Sent Events (30s interval)
- [ ] **BI-04**: 8 pre-built metrics: revenue_by_month, expense_by_category, headcount_by_department, inventory_value_by_warehouse, po_approval_cycle_time, leave_utilisation_by_type, project_budget_vs_actual, demand_forecast_accuracy
- [ ] **BI-05**: Scheduled report generation (PDF via Puppeteer, Excel via ExcelJS) emailed on cron schedule

### Project Management (PM)

- [ ] **PM-01**: Project CRUD with code, manager, budget, actual cost, status tracking
- [ ] **PM-02**: Task dependencies as DAG with cycle detection — throws CircularDependencyException
- [ ] **PM-03**: Budget overrun alert fires when actualCost > budget by ≥ 10%
- [ ] **PM-04**: Resource utilization: allocated hours vs available hours per employee
- [ ] **PM-05**: Milestones with due dates, status, and completion tracking

### Notifications & Events (NOTIF)

- [ ] **NOTIF-01**: Outbox pattern: events written in same DB transaction as business data, polled every 5s
- [ ] **NOTIF-02**: 4 notification channels: IN_APP, EMAIL, SMS, WEBHOOK
- [ ] **NOTIF-03**: 20+ event types covering all modules (invoice, PO, payroll, leave, project, inventory, user, forecast)
- [ ] **NOTIF-04**: Webhook HMAC signing with SHA-256 and timing-safe comparison
- [ ] **NOTIF-05**: Handlebars templates for notification content, configurable per tenant
- [ ] **NOTIF-06**: User notification preferences: per event type, per channel, enable/disable

### Frontend (UI)

- [ ] **UI-01**: Next.js 15 App Router with (auth) and (dashboard) route groups
- [ ] **UI-02**: Keycloak OIDC via next-auth v5 with auto-refresh and middleware protection
- [ ] **UI-03**: Every data table has: column sorting, filtering, global search (debounced 300ms), server-side pagination, row selection, CSV/Excel export, loading skeleton, empty state, error state with retry
- [ ] **UI-04**: Every form uses React Hook Form + Zod with inline errors, disabled during submit, success/error toasts, unsaved changes warning
- [ ] **UI-05**: Finance: journal entry form with dynamic lines, real-time debit/credit balance, account fuzzy search, multi-currency FX preview
- [ ] **UI-06**: HR: payroll run dashboard with WebSocket progress, payslip preview, bulk email, ZIP download
- [ ] **UI-07**: Supply Chain: inventory heatmap (warehouse × product grid, color-coded stock levels)
- [ ] **UI-08**: BI: drag-and-drop dashboard builder with react-grid-layout, live preview
- [ ] **UI-09**: Projects: D3.js Gantt chart with dependency arrows, drag-to-reschedule, renders < 1s for 500 tasks
- [ ] **UI-10**: WCAG 2.1 AA: focus indicators, alt text, labels, contrast ≥ 4.5:1, keyboard navigation, screen reader support
- [ ] **UI-11**: Responsive: 375px (mobile), 768px (tablet), 1440px (desktop)
- [ ] **UI-12**: PWA service worker with IndexedDB offline queue, last-write-wins sync, offline banner

### API Gateway & GraphQL (API)

- [ ] **API-01**: OpenAPI 3.1 auto-generated from NestJS decorators with full endpoint documentation
- [ ] **API-02**: Standard response/error envelopes with requestId, pagination meta, timestamps
- [ ] **API-03**: API versioning via URL prefix /api/v1/
- [ ] **API-04**: GraphQL (Apollo Server v4) for BI queries only — schema-first, DataLoader, depth limit 7, complexity limit 1000
- [ ] **API-05**: Persisted queries and introspection disabled in production

### Security (SEC)

- [ ] **SEC-01**: JWT RS256 with 15-min access token, 8-hour refresh token, rotation on use
- [ ] **SEC-02**: Token blacklist in Redis on logout or password change
- [ ] **SEC-03**: class-validator on ALL NestJS DTOs; Zod on ALL Next.js forms
- [ ] **SEC-04**: File upload: MIME type + magic bytes check, max 10MB, allowed: PDF/JPG/PNG/XLSX
- [ ] **SEC-05**: CSP header disallowing inline scripts; Helmet.js with HSTS, X-Frame-Options deny
- [ ] **SEC-06**: Rate limiting: 100 req/min global, 10 req/min auth, 5 req/min OCR, 1 req/hr payroll
- [ ] **SEC-07**: IDOR prevention: every resource lookup filters by tenantId from JWT, never request body
- [ ] **SEC-08**: Cross-tenant access test returns 403 for every module
- [ ] **SEC-09**: Concurrent session limit: max 5 per user

### Testing (TEST)

- [ ] **TEST-01**: Unit tests ≥ 80% line coverage on all service classes
- [ ] **TEST-02**: Integration tests: every API endpoint has happy-path and error-path test
- [ ] **TEST-03**: 8 critical E2E user journeys via Playwright
- [ ] **TEST-04**: Test utilities: createTestTenant, createTestUser, cleanupTestTenant, mockKeycloak, seedFinanceData, seedInventoryData
- [ ] **TEST-05**: k6 load test: 2,000 concurrent users, P95 < 300ms, error rate < 1%

### Containerization & Kubernetes (K8S)

- [x] **K8S-01**: Multi-stage Dockerfiles for api (distroless), web (alpine), ml-service (python slim) — non-root, no shell
- [x] **K8S-02**: Helm chart with Deployments, Services, Ingress (TLS), HPA, PDB, NetworkPolicy, ResourceQuota, LimitRange
- [x] **K8S-03**: Istio VirtualService for canary deployment (90/10 traffic split)
- [x] **K8S-04**: ArgoCD Application manifest with automated sync, self-heal, prune, sync waves

### CI/CD (CICD)

- [ ] **CICD-01**: GitHub Actions pipeline: lint → typecheck → unit tests → integration tests → security scan → E2E → build → deploy staging → deploy production
- [ ] **CICD-02**: trufflehog secrets scan fails build on any committed secret
- [ ] **CICD-03**: snyk + trivy scan fails build on HIGH/CRITICAL vulnerabilities
- [ ] **CICD-04**: Production deployment requires manual approval in GitHub

### Observability (OBS)

- [ ] **OBS-01**: OpenTelemetry SDK initialized before all imports with OTLP trace exporter and Prometheus metrics
- [ ] **OBS-02**: Custom business metrics: invoices_processed_total, payroll_run_duration_seconds, forecast_mape_percent, active_users_per_tenant
- [ ] **OBS-03**: 3 Grafana dashboards: API Performance, Business Metrics, Infrastructure
- [ ] **OBS-04**: Prometheus alerting rules for P95 latency > 300ms, error rate > 1%, DB connection pool exhausted, payroll job failed, MAPE > 20%

### Cloud Deployment (CLOUD)

- [ ] **CLOUD-01**: Terraform EKS cluster, Aurora Serverless v2 (PG17), ElastiCache Redis, S3 with encryption + lifecycle
- [ ] **CLOUD-02**: WAF with AWS managed rule sets and rate limiting
- [ ] **CLOUD-03**: Helm values files for dev, staging, production environments

### GDPR & Compliance (GDPR)

- [ ] **GDPR-01**: Right to Access: export all user data from all tables as encrypted JSON with signed download URL
- [ ] **GDPR-02**: Right to Erasure: pseudonymise PII fields (firstName, lastName, email, phone, address); hard delete sessions and files
- [ ] **GDPR-03**: DSR completes within 72 hours (automated)
- [ ] **GDPR-04**: Retention policies: AuditLog 7 years, PayrollData 7 years, Notifications 1 year, OutboxEvents 90 days, GDPR exports 7 days

### Documentation (DOCS)

- [ ] **DOCS-01**: Comprehensive README with architecture diagram, setup instructions, env vars reference, scripts reference
- [ ] **DOCS-02**: 6 ADRs: monorepo, modular monolith, Keycloak, PostgreSQL, Prophet/LSTM, outbox pattern
- [ ] **DOCS-03**: OpenAPI 3.1 spec with Swagger UI at /api-docs (dev/staging only), every endpoint fully documented

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Platform
- **PLAT-01**: Multi-region deployment for data residency compliance
- **PLAT-02**: Custom workflow builder (low-code approval chains)
- **PLAT-03**: Mobile native apps (iOS/Android)

### Integration
- **INT-01**: CRM integration (Salesforce, HubSpot)
- **INT-02**: Banking integration (direct bank feeds)
- **INT-03**: E-commerce connector (Shopify, WooCommerce)

### Advanced AI
- **AI-01**: Natural language query interface for reports
- **AI-02**: Anomaly detection in financial transactions
- **AI-03**: Automated expense categorization

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Custom SQL report builder | Security risk — SQL injection vector; pre-built dashboards sufficient |
| Real-time collaborative editing | CRDT/OT complexity; not core ERP value |
| Built-in CRM | Scope creep; integrate via API |
| Native mobile apps | PWA covers mobile for v1 |
| AI chatbot | Quality not production-ready for financial data |
| Blockchain audit trail | Unnecessary complexity; TimescaleDB sufficient |
| Multi-region deployment | Single-region sufficient for v1 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01..04 | Phase 1 | Pending |
| DB-01..05 | Phase 2 | Pending |
| AUTH-01..10 | Phase 2 | Pending |
| FIN-01..08 | Phase 3 | Pending |
| APAR-01..06 | Phase 4 | Pending |
| HR-01..07 | Phase 5 | Pending |
| PAY-01..06 | Phase 6 | Pending |
| SC-01..06 | Phase 7 | Pending |
| ML-01..05 | Phase 8 | Pending |
| BI-01..05 | Phase 9 | Pending |
| PM-01..05 | Phase 10 | Pending |
| NOTIF-01..06 | Phase 11 | Pending |
| UI-01..12 | Phase 12 | Pending |
| API-01..05 | Phase 13 | Pending |
| SEC-01..09 | Phase 14 | Pending |
| TEST-01..05 | Phase 15 | Pending |
| K8S-01..04 | Phase 16 | Completed |
| CICD-01..04 | Phase 17 | Pending |
| OBS-01..04 | Phase 18 | Pending |
| CLOUD-01..03 | Phase 18 | Pending |
| GDPR-01..04 | Phase 18 | Pending |
| DOCS-01..03 | Phase 18 | Pending |

**Coverage:**
- v1 requirements: 122 total
- Mapped to phases: 122
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 after initial definition*
