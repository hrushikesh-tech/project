# Features Research: Cloud ERP Platform

## Table Stakes (Must-Have — Users Leave Without These)

### Finance
- **General Ledger** with double-entry bookkeeping — the foundation of any ERP
- **Accounts Payable/Receivable** — invoice management, aging reports
- **Multi-currency support** with live FX rates
- **Period close** to lock accounting periods
- **Chart of Accounts** (tree structure, configurable)
- **Trial Balance, Balance Sheet, Income Statement** reporting
- **Tax compliance** automation (configurable by jurisdiction)

### HR & Payroll
- **Employee lifecycle** management (hire to termination)
- **Org chart** with department hierarchy
- **Leave management** with approval workflows
- **Attendance tracking** (clock in/out, overtime)
- **Payroll processing** with statutory deductions
- **Payslip generation** (PDF)

### Supply Chain
- **Vendor management** with payment terms
- **Purchase order** lifecycle (create → approve → receive)
- **Inventory tracking** (multi-warehouse, real-time)
- **Goods receipt** linked to POs
- **Reorder automation** based on stock levels
- **Inventory costing** (FIFO/AVCO)

### Platform
- **Multi-tenant isolation** — non-negotiable for SaaS
- **RBAC with fine-grained permissions** per module
- **SSO via OIDC/SAML** — enterprise clients expect this
- **Audit trail** — every change logged with before/after
- **Notification engine** (in-app, email at minimum)
- **Data export** (CSV, Excel for all list views)

## Differentiators (Competitive Advantage)

### AI/ML
- **Demand forecasting** with Prophet/LSTM — predictive inventory management
- **Invoice OCR** — automated data extraction from scanned invoices
- **3-way matching** automation — invoice ↔ PO ↔ goods receipt
- **Anomaly detection** in financial data

### BI & Analytics
- **Drag-and-drop dashboard builder** — customizable per user/role
- **Real-time KPI cards** with SSE refresh
- **Scheduled report generation** (PDF/Excel emailed on cron)
- **GraphQL aggregation queries** for complex cross-module analytics

### Project Management
- **DAG-validated task dependencies** — prevent circular dependencies
- **Gantt chart visualization** (D3.js)
- **Budget vs actual tracking** with overrun alerts
- **Resource utilization** reporting

### Advanced Platform
- **Webhook subscriptions** with HMAC signing
- **PWA/offline support** for field workers
- **GDPR compliance** tooling (data export, erasure, retention)
- **OpenAPI 3.1 auto-generated** documentation

## Anti-Features (Do NOT Build)

| Feature | Why Not |
|---------|---------|
| Custom SQL report builder | Security risk — SQL injection vector; pre-built dashboards sufficient |
| Real-time collaborative editing | Massive complexity (CRDT/OT); not core ERP value |
| Built-in CRM | Scope creep; integrate Salesforce/HubSpot via API |
| Mobile native apps | PWA covers mobile needs for v1; native apps in future |
| AI chatbot / natural language queries | Gimmicky at current quality; dashboards serve better |
| Blockchain audit trail | Unnecessary complexity; DB + TimescaleDB sufficient |

## Feature Complexity Ratings

| Feature | Complexity | Dependencies |
|---------|-----------|-------------|
| General Ledger | High | Database, Auth |
| Invoice OCR | High | S3, Textract/Tesseract, BullMQ |
| Payroll Engine | Very High | GL, HR core, tax rules, BullMQ |
| Demand Forecasting | High | ML service, historical data pipeline |
| Dashboard Builder | Medium-High | All modules (data sources) |
| Gantt Chart | Medium | D3.js, task dependencies |
| GDPR Tooling | Medium | All modules (data mapping) |
| Event Engine | Medium | Redis, BullMQ, outbox pattern |

---
*Researched: 2026-04-09*
