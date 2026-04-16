# Phase 4: AP/AR Automation - Technical Research

**Objective:** Define a concrete backend architecture for invoice ingestion, OCR extraction, three-way matching, ledger posting, mismatch handling, and AP/AR aging on top of the existing Phase 3 finance foundation.

## 1. Starting Point in the Codebase

- `packages/db/prisma/schema.prisma` already includes `Invoice`, `InvoiceLine`, `ThreeWayMatch`, `Vendor`, `PurchaseOrder`, `PurchaseOrderLine`, `GoodsReceipt`, and `GoodsReceiptLine`, but those models are not yet finance-aware enough to support tenant-safe ledger posting and receivables reporting.
- `apps/api/src/finance/finance.service.ts` already provides tenant-scoped journal creation, posting, period-close enforcement, FX support, and report generation. Phase 4 should reuse this ledger logic instead of duplicating posting rules.
- `apps/api/test/helpers/finance-test-store.mjs` and existing finance API tests give the project a working pattern for in-memory service and integration tests. Phase 4 should extend that harness for AP/AR flows rather than introducing an unrelated test style.

## 2. Recommended Phase Shape

Create a dedicated `apps/api/src/ap-ar/` module with these responsibilities:

- `ApArController` for upload, invoice review, invoice listing/detail, match triggers, and aging reports
- `ApArService` for request-path orchestration
- `InvoiceStorageService` for S3 object persistence
- `InvoiceOcrQueueService` and BullMQ processor for asynchronous OCR
- `OcrProvider` abstraction with:
  - `TextractOcrProvider` as the primary provider
  - `TesseractOcrProvider` as the local fallback
- `ThreeWayMatchService` for PO/GR/invoice matching logic
- `InvoiceLedgerPostingService` for AP auto-posting through the existing finance module
- `AgingReportService` for AP/AR buckets

This keeps Phase 4 isolated from future Supply Chain and Notification phases while still writing durable contracts (`OutboxEvent`, `Notification`) those later phases can consume.

## 3. Data Model Changes Needed Before Execution

The current schema is missing several fields needed to make AP/AR operationally correct:

### 3.1 Legal-Entity Awareness

`FinanceService` requires `legalEntityId` to post into the correct books, but the AP/AR models currently do not consistently carry that information. Phase 4 should add `legalEntityId` to:

- `Invoice`
- `Vendor`
- `PurchaseOrder`
- `GoodsReceipt`
- `Customer` (new model)

This aligns AP/AR records with Phase 3 journal posting rules and prevents cross-entity posting mistakes.

### 3.2 Receivables Counterparty Model

`Invoice.customerId` exists today but there is no `Customer` model. Receivables aging is not implementable cleanly without a first-class customer record. Phase 4 should introduce:

- `Customer` model mirroring the core vendor fields
- optional `receivablesAccountId` for AR posting defaults

### 3.3 Invoice Lifecycle Metadata

The current `Invoice` model can store raw OCR output in `ocrData`, but it lacks enough operational state. Add:

- `issueDate`
- `purchaseOrderId` and `poNumber`
- `sourceDocumentKey`
- `sourceDocumentMimeType`
- `ocrStatus`
- `ocrProvider`
- `reviewReason`
- `postedJournalEntryId`
- `counterpartyName`

These fields make queue retries, operator review, traceability, and idempotent posting practical.

### 3.4 Matching Audit Fields

`ThreeWayMatch` should grow beyond `amountMatch` and `lineItemSimilarity`. Add:

- `quantityMatch`
- `variancePercent`
- `matchedAt`
- `reviewedAt`
- `reviewedBy`
- `mismatchReasons Json`

This turns the record into a durable review artifact rather than a single boolean snapshot.

## 4. Upload and OCR Pipeline

### 4.1 Request Flow

Recommended upload flow:

1. `POST /api/v1/ap-ar/invoices/upload` accepts multipart invoice files plus invoice metadata (`legalEntityId`, `type`, optional `vendorId`/`customerId`, optional `poNumber`).
2. Validate:
   - max file size `10MB`
   - allowed MIME/magic bytes: `application/pdf`, `image/png`, `image/jpeg`
3. Upload the source document to S3 using key pattern:
   - `invoices/{tenantId}/{invoiceId}/source.{ext}`
4. Create a draft invoice with:
   - `status = "OCR_PENDING"`
   - `ocrStatus = "QUEUED"`
   - `sourceDocumentKey`
   - `sourceDocumentMimeType`
5. Enqueue a BullMQ job carrying `tenantId`, `invoiceId`, `bucket`, `objectKey`, and the requested provider mode.

Even when OCR later fails or is incomplete, the uploaded invoice should remain as a reviewable draft with an explicit reason rather than being rejected as a failed import.

### 4.2 Queue / Worker Shape

Use `@nestjs/bullmq` + Redis 8 with one queue for OCR:

- queue: `invoice-ocr`
- retries: `3`
- exponential backoff
- dead-letter/failure capture written to invoice `reviewReason` and `ocrStatus = "FAILED"`

The worker should use `PrismaService.raw` to obtain an unscoped client, then explicitly re-apply tenant filters using the `tenantId` stored in the job payload.

### 4.3 OCR Provider Strategy

Primary provider:

- `@aws-sdk/client-textract`

Fallback provider:

- `tesseract.js`
- `pdfjs-dist` plus `@napi-rs/canvas` for PDF page rasterization
- `sharp` for image normalization before OCR

This keeps the fallback local, avoids shelling out to external binaries, and stays compatible with the current Node/NestJS stack.

### 4.4 OCR Mapping Rules

Normalize OCR output into:

- invoice number
- issue date
- due date
- vendor or customer name
- line items
- subtotal
- tax amount
- total amount
- referenced PO number

Persist:

- raw provider payload in `Invoice.ocrData`
- normalized line items in `InvoiceLine`
- unresolved ambiguities in `reviewReason`

If critical fields are missing, the worker should still persist the draft invoice and mark it `PENDING_REVIEW` rather than failing hard.

## 5. Three-Way Matching and Ledger Posting

### 5.1 Match Scope

Three-way matching applies to payable invoices only:

- `Invoice`
- `PurchaseOrder`
- `GoodsReceipt`

Receivable invoices still participate in aging but do not use PO/GR matching.

### 5.2 Match Rules

Implement the roadmap thresholds exactly:

- PO number match required
- total amount variance within `1%`
- line similarity `>= 0.85`
- received quantities must cover invoice quantities

A practical implementation is:

- normalize line descriptions to lowercase tokens
- compare invoice lines against PO lines using token-overlap similarity
- confirm goods receipt quantities cover the invoice quantity total for each matched PO line

### 5.3 Auto-Approval and Posting

When all match conditions pass:

- create/update `ThreeWayMatch` with `matchStatus = "MATCHED"`
- set invoice status to `APPROVED`
- create a journal entry through the existing finance posting stack
- post the journal entry immediately
- write the resulting journal entry id back to `Invoice.postedJournalEntryId`
- set invoice status to `POSTED`

To make this reliable, Vendor and Customer records should carry explicit counterparty control-account references:

- `payablesAccountId` for AP
- `receivablesAccountId` for AR

If that configuration is missing, the invoice should remain `PENDING_REVIEW` with an explicit configuration error rather than posting to an inferred account or an entity-level fallback.

## 6. Mismatch Handling and Notifications

Phase 11 is not built yet, but Phase 4 still needs durable mismatch notification behavior. The best bridge is:

- write an `OutboxEvent` such as `invoice.match_failed`
- create lightweight `Notification` rows for finance-side users in the tenant during Phase 4 itself

This satisfies the “notify AP team” requirement now and cleanly hands off to the later notification engine without rework.

## 7. Aging Report Design

Recommended endpoint:

- `GET /api/v1/ap-ar/reports/aging`

Query inputs:

- `legalEntityId`
- `type` (`PAYABLE` or `RECEIVABLE`)
- `asOfDate`
- optional `vendorId`
- optional `customerId`

Bucket rules:

- `current`: `daysPastDue <= 0`
- `30`: `1..30`
- `60`: `31..60`
- `over60`: `> 60`

Until a payments module exists, treat open balance as:

- full `totalAmount` for statuses other than `PAID` and `VOID`

Return both:

- aggregate bucket totals
- invoice-level detail rows for operator drill-down

## Validation Architecture

Use the existing API build + Node test flow from Phase 3:

1. **Schema / contract verification**
   - `pnpm --filter @amdox/db generate`
   - `pnpm --filter @amdox/api build`
2. **Unit verification**
   - OCR mapper normalization
   - provider fallback selection
   - match threshold logic
   - aging bucket calculations
3. **Integration verification**
   - invoice upload queues a job and creates a draft record
   - OCR worker populates invoice lines and metadata
   - matched invoice auto-posts to the ledger
   - mismatches emit outbox events / notifications
   - aging report returns correct current / 30 / 60 / over-60 values

## 8. Risks to Call Out in the Plans

- File upload abuse and malformed PDFs/images
- Duplicate OCR jobs creating duplicate invoice rows
- Cross-tenant leakage in background workers
- Auto-posting to wrong legal entity or wrong control account
- Mismatch events disappearing before the notification engine exists
- AR support stalling if `Customer` is not introduced now
