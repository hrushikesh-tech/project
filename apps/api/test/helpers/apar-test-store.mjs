import { createRequire } from 'node:module';
import { createFinanceHarness } from './finance-test-store.mjs';

const require = createRequire(import.meta.url);
const { Prisma } = require('@amdox/db');

export function createAparHarness(options = {}) {
  const base = createFinanceHarness(options);
  const state = base.state;

  Object.assign(state, {
    users: [],
    vendors: [],
    customers: [],
    warehouses: [],
    purchaseOrders: [],
    purchaseOrderLines: [],
    goodsReceipts: [],
    goodsReceiptLines: [],
    invoices: [],
    invoiceLines: [],
    threeWayMatches: [],
    outboxEvents: [],
    notifications: [],
  });

  let sequence = 1;
  const nextId = (prefix) => `${prefix}-${sequence++}`;
  const now = () => new Date();
  const clone = (record) => (record ? { ...record } : record);

  const ensureLegalEntityId = (overrides = {}) => {
    if (overrides.legalEntityId) {
      return overrides.legalEntityId;
    }

    if (state.legalEntities[0]?.id) {
      return state.legalEntities[0].id;
    }

    return base.insertLegalEntity().id;
  };

  const ensureVendorId = (overrides = {}) => {
    if (overrides.vendorId) {
      return overrides.vendorId;
    }

    if (state.vendors[0]?.id) {
      return state.vendors[0].id;
    }

    return insertVendor({ legalEntityId: ensureLegalEntityId(overrides) }).id;
  };

  const ensureCustomerId = (overrides = {}) => {
    if (overrides.customerId) {
      return overrides.customerId;
    }

    if (state.customers[0]?.id) {
      return state.customers[0].id;
    }

    return insertCustomer({ legalEntityId: ensureLegalEntityId(overrides) }).id;
  };

  const ensureWarehouseId = (overrides = {}) => {
    if (overrides.warehouseId) {
      return overrides.warehouseId;
    }

    if (state.warehouses[0]?.id) {
      return state.warehouses[0].id;
    }

    return insertWarehouse().id;
  };

  const insertVendor = (overrides = {}) => {
    const record = {
      id: nextId('vendor'),
      tenantId: state.tenants[0]?.id ?? options.tenantId ?? 'tenant-1',
      legalEntityId: ensureLegalEntityId(overrides),
      name: overrides.name ?? `Vendor ${sequence}`,
      code: overrides.code ?? `VENDOR-${sequence}`,
      email: overrides.email ?? null,
      phone: overrides.phone ?? null,
      address: overrides.address ?? null,
      paymentTerms: overrides.paymentTerms ?? 30,
      currency: overrides.currency ?? 'INR',
      status: overrides.status ?? 'ACTIVE',
      payablesAccountId: overrides.payablesAccountId ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.vendors.push(record);
    return clone(record);
  };

  const insertCustomer = (overrides = {}) => {
    const record = {
      id: nextId('customer'),
      tenantId: state.tenants[0]?.id ?? options.tenantId ?? 'tenant-1',
      legalEntityId: ensureLegalEntityId(overrides),
      name: overrides.name ?? `Customer ${sequence}`,
      code: overrides.code ?? `CUSTOMER-${sequence}`,
      email: overrides.email ?? null,
      phone: overrides.phone ?? null,
      address: overrides.address ?? null,
      paymentTerms: overrides.paymentTerms ?? 30,
      currency: overrides.currency ?? 'INR',
      status: overrides.status ?? 'ACTIVE',
      receivablesAccountId: overrides.receivablesAccountId ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.customers.push(record);
    return clone(record);
  };

  const insertWarehouse = (overrides = {}) => {
    const record = {
      id: nextId('warehouse'),
      tenantId: state.tenants[0]?.id ?? options.tenantId ?? 'tenant-1',
      name: overrides.name ?? `Warehouse ${sequence}`,
      code: overrides.code ?? `WH-${sequence}`,
      address: overrides.address ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.warehouses.push(record);
    return clone(record);
  };

  const insertPurchaseOrder = (overrides = {}) => {
    const record = {
      id: nextId('po'),
      tenantId: state.tenants[0]?.id ?? options.tenantId ?? 'tenant-1',
      legalEntityId: ensureLegalEntityId(overrides),
      vendorId: ensureVendorId(overrides),
      poNumber: overrides.poNumber ?? `PO-${sequence}`,
      status: overrides.status ?? 'APPROVED',
      totalAmount: 0n,
      currency: overrides.currency ?? 'INR',
      expectedDelivery: overrides.expectedDelivery ?? null,
      approvedBy: overrides.approvedBy ?? 'seed-user',
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    record.totalAmount = BigInt(overrides.totalAmount ?? record.totalAmount ?? 0);

    delete record.lines;
    state.purchaseOrders.push(record);

    for (const line of overrides.lines ?? []) {
      state.purchaseOrderLines.push({
        id: nextId('po-line'),
        tenantId: record.tenantId,
        purchaseOrderId: record.id,
        productId: line.productId ?? nextId('product'),
        description: line.description ?? 'Seed PO line',
        quantity: new Prisma.Decimal(String(line.quantity ?? 1)),
        unitPrice: BigInt(line.unitPrice ?? 0),
        receivedQuantity: new Prisma.Decimal(String(line.receivedQuantity ?? 0)),
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null,
        ...line,
      });
    }

    return clone(record);
  };

  const insertGoodsReceipt = (overrides = {}) => {
    const purchaseOrderId =
      overrides.purchaseOrderId ?? state.purchaseOrders[0]?.id ?? insertPurchaseOrder(overrides).id;
    const legalEntityId =
      overrides.legalEntityId ??
      state.purchaseOrders.find((item) => item.id === purchaseOrderId)?.legalEntityId ??
      ensureLegalEntityId(overrides);

    const record = {
      id: nextId('gr'),
      tenantId: state.tenants[0]?.id ?? options.tenantId ?? 'tenant-1',
      purchaseOrderId,
      legalEntityId,
      warehouseId: ensureWarehouseId(overrides),
      receivedDate: overrides.receivedDate ?? now(),
      receivedBy: overrides.receivedBy ?? 'warehouse-user',
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };

    delete record.lines;
    state.goodsReceipts.push(record);

    for (const line of overrides.lines ?? []) {
      state.goodsReceiptLines.push({
        id: nextId('gr-line'),
        tenantId: record.tenantId,
        goodsReceiptId: record.id,
        purchaseOrderLineId:
          line.purchaseOrderLineId ?? state.purchaseOrderLines[0]?.id ?? nextId('po-line-ref'),
        quantityReceived: new Prisma.Decimal(String(line.quantityReceived ?? 1)),
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null,
        ...line,
      });
    }

    return clone(record);
  };

  const insertInvoice = (overrides = {}) => {
    const type = overrides.type ?? 'PAYABLE';
    const legalEntityId = ensureLegalEntityId(overrides);
    const vendorId = type === 'PAYABLE' ? ensureVendorId({ ...overrides, legalEntityId }) : null;
    const customerId =
      type === 'RECEIVABLE' ? ensureCustomerId({ ...overrides, legalEntityId }) : null;
    const tenantId = state.tenants[0]?.id ?? options.tenantId ?? 'tenant-1';

    const record = {
      id: nextId('invoice'),
      tenantId,
      invoiceNumber: overrides.invoiceNumber ?? `INV-${sequence}`,
      legalEntityId,
      vendorId,
      customerId,
      purchaseOrderId: overrides.purchaseOrderId ?? null,
      type,
      status: overrides.status ?? 'OCR_PENDING',
      issueDate: overrides.issueDate ?? new Date('2026-04-01T00:00:00.000Z'),
      totalAmount: 0n,
      taxAmount: 0n,
      currency: overrides.currency ?? 'INR',
      dueDate: overrides.dueDate ?? new Date('2026-05-01T00:00:00.000Z'),
      poNumber: overrides.poNumber ?? null,
      paidAt: overrides.paidAt ?? null,
      sourceDocumentKey: overrides.sourceDocumentKey ?? `invoices/${tenantId}/source.pdf`,
      sourceDocumentMimeType: overrides.sourceDocumentMimeType ?? 'application/pdf',
      ocrStatus: overrides.ocrStatus ?? 'QUEUED',
      ocrProvider: overrides.ocrProvider ?? null,
      reviewReason: overrides.reviewReason ?? null,
      counterpartyName:
        overrides.counterpartyName ??
        state.vendors.find((item) => item.id === vendorId)?.name ??
        state.customers.find((item) => item.id === customerId)?.name ??
        'Seed Counterparty',
      postedJournalEntryId: overrides.postedJournalEntryId ?? null,
      ocrData: overrides.ocrData ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    record.totalAmount = BigInt(overrides.totalAmount ?? record.totalAmount ?? 0);
    record.taxAmount = BigInt(overrides.taxAmount ?? record.taxAmount ?? 0);

    delete record.lines;
    state.invoices.push(record);

    for (const line of overrides.lines ?? []) {
      state.invoiceLines.push({
        id: nextId('invoice-line'),
        tenantId: record.tenantId,
        invoiceId: record.id,
        description: line.description ?? 'Seed invoice line',
        quantity: new Prisma.Decimal(String(line.quantity ?? 1)),
        unitPrice: BigInt(line.unitPrice ?? 0),
        amount: BigInt(line.amount ?? line.unitPrice ?? 0),
        taxRate: new Prisma.Decimal(String(line.taxRate ?? 0)),
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null,
        ...line,
      });
    }

    return clone(record);
  };

  const insertThreeWayMatch = (overrides = {}) => {
    const invoiceId = overrides.invoiceId ?? state.invoices[0]?.id ?? insertInvoice(overrides).id;
    const purchaseOrderId =
      overrides.purchaseOrderId ?? state.purchaseOrders[0]?.id ?? insertPurchaseOrder(overrides).id;
    const goodsReceiptId =
      overrides.goodsReceiptId ?? state.goodsReceipts[0]?.id ?? insertGoodsReceipt({ purchaseOrderId }).id;

    const record = {
      id: nextId('match'),
      tenantId: state.tenants[0]?.id ?? options.tenantId ?? 'tenant-1',
      invoiceId,
      purchaseOrderId,
      goodsReceiptId,
      matchStatus: overrides.matchStatus ?? 'PENDING',
      amountMatch: overrides.amountMatch ?? false,
      quantityMatch: overrides.quantityMatch ?? false,
      lineItemSimilarity:
        overrides.lineItemSimilarity instanceof Prisma.Decimal
          ? overrides.lineItemSimilarity
          : new Prisma.Decimal(String(overrides.lineItemSimilarity ?? 0)),
      variancePercent:
        overrides.variancePercent == null
          ? null
          : new Prisma.Decimal(String(overrides.variancePercent)),
      mismatchReasons: overrides.mismatchReasons ?? null,
      matchedAt: overrides.matchedAt ?? null,
      reviewedAt: overrides.reviewedAt ?? null,
      reviewedBy: overrides.reviewedBy ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.threeWayMatches.push(record);
    return clone(record);
  };

  const insertOutboxEvent = (overrides = {}) => {
    const record = {
      id: nextId('outbox'),
      tenantId: state.tenants[0]?.id ?? options.tenantId ?? 'tenant-1',
      eventType: overrides.eventType ?? 'invoice.match_failed',
      payload: overrides.payload ?? {},
      status: overrides.status ?? 'PENDING',
      processedAt: overrides.processedAt ?? null,
      retryCount: overrides.retryCount ?? 0,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.outboxEvents.push(record);
    return clone(record);
  };

  const insertNotification = (overrides = {}) => {
    const record = {
      id: nextId('notification'),
      tenantId: state.tenants[0]?.id ?? options.tenantId ?? 'tenant-1',
      userId: overrides.userId ?? 'finance-manager-1',
      type: overrides.type ?? 'invoice.review_required',
      channel: overrides.channel ?? 'IN_APP',
      title: overrides.title ?? 'Invoice review required',
      body: overrides.body ?? null,
      isRead: overrides.isRead ?? false,
      readAt: overrides.readAt ?? null,
      metadata: overrides.metadata ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.notifications.push(record);
    return clone(record);
  };

  const insertUser = (overrides = {}) => {
    const record = {
      id: nextId('user'),
      tenantId: state.tenants[0]?.id ?? options.tenantId ?? 'tenant-1',
      email: overrides.email ?? `finance-${sequence}@amdox.dev`,
      firstName: overrides.firstName ?? 'Finance',
      lastName: overrides.lastName ?? 'Manager',
      keycloakId: overrides.keycloakId ?? `kc-${sequence}`,
      role: overrides.role ?? 'finance_manager',
      isActive: overrides.isActive ?? true,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.users.push(record);
    return clone(record);
  };

  const attachPurchaseOrder = (record, include = {}) => {
    if (!record) return null;

    const output = clone(record);
    if (include.vendor) {
      output.vendor = clone(state.vendors.find((item) => item.id === record.vendorId) ?? null);
    }
    if (include.legalEntity) {
      output.legalEntity = clone(
        state.legalEntities.find((item) => item.id === record.legalEntityId) ?? null,
      );
    }
    if (include.lines) {
      output.lines = state.purchaseOrderLines
        .filter((item) => item.purchaseOrderId === record.id)
        .map(clone);
    }
    if (include.goodsReceipts) {
      output.goodsReceipts = state.goodsReceipts
        .filter((item) => item.purchaseOrderId === record.id)
        .map((item) => attachGoodsReceipt(item, include.goodsReceipts.include));
    }
    return output;
  };

  const attachGoodsReceipt = (record, include = {}) => {
    if (!record) return null;

    const output = clone(record);
    if (include.purchaseOrder) {
      output.purchaseOrder = attachPurchaseOrder(
        state.purchaseOrders.find((item) => item.id === record.purchaseOrderId) ?? null,
        include.purchaseOrder.include,
      );
    }
    if (include.lines) {
      output.lines = state.goodsReceiptLines
        .filter((item) => item.goodsReceiptId === record.id)
        .map(clone);
    }
    if (include.legalEntity) {
      output.legalEntity = clone(
        state.legalEntities.find((item) => item.id === record.legalEntityId) ?? null,
      );
    }
    if (include.warehouse) {
      output.warehouse = clone(
        state.warehouses.find((item) => item.id === record.warehouseId) ?? null,
      );
    }
    return output;
  };

  const attachInvoice = (record, include = {}) => {
    if (!record) return null;

    const output = clone(record);
    if (include.vendor) {
      output.vendor = clone(state.vendors.find((item) => item.id === record.vendorId) ?? null);
    }
    if (include.customer) {
      output.customer = clone(state.customers.find((item) => item.id === record.customerId) ?? null);
    }
    if (include.purchaseOrder) {
      output.purchaseOrder = attachPurchaseOrder(
        state.purchaseOrders.find((item) => item.id === record.purchaseOrderId) ?? null,
        include.purchaseOrder.include,
      );
    }
    if (include.lines) {
      output.lines = state.invoiceLines
        .filter((item) => item.invoiceId === record.id)
        .map(clone);
    }
    if (include.postedJournalEntry) {
      output.postedJournalEntry = clone(
        state.journalEntries.find((item) => item.id === record.postedJournalEntryId) ?? null,
      );
    }
    if (include.threeWayMatch) {
      output.threeWayMatch = clone(
        state.threeWayMatches.find((item) => item.invoiceId === record.id) ?? null,
      );
    }
    return output;
  };

  const matches = (item, where = {}) => {
    if (!where) return true;
    for (const [key, value] of Object.entries(where)) {
      if (value === undefined) {
        continue;
      }
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        if (value.in) {
          if (!value.in.includes(item[key])) {
            return false;
          }
          continue;
        }
      }
      if (item[key] !== value) {
        return false;
      }
    }
    return true;
  };

  Object.assign(base.prisma, {
    forTenant() {
      return base.prisma;
    },
    user: {
      async findMany({ where = {} } = {}) {
        return state.users.filter((item) => matches(item, where)).map(clone);
      },
      async findFirst({ where = {} } = {}) {
        return clone(state.users.find((item) => matches(item, where)) ?? null);
      },
      async create({ data }) {
        return insertUser(data);
      },
    },
    vendor: {
      async findMany({ where = {} } = {}) {
        return state.vendors.filter((item) => matches(item, where)).map(clone);
      },
      async findFirst({ where = {} } = {}) {
        return clone(state.vendors.find((item) => matches(item, where)) ?? null);
      },
      async create({ data }) {
        return insertVendor(data);
      },
    },
    customer: {
      async findMany({ where = {} } = {}) {
        return state.customers.filter((item) => matches(item, where)).map(clone);
      },
      async findFirst({ where = {} } = {}) {
        return clone(state.customers.find((item) => matches(item, where)) ?? null);
      },
      async create({ data }) {
        return insertCustomer(data);
      },
    },
    purchaseOrder: {
      async findMany({ where = {}, include } = {}) {
        return state.purchaseOrders
          .filter((item) => matches(item, where))
          .map((item) => attachPurchaseOrder(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachPurchaseOrder(
          state.purchaseOrders.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async create({ data, include } = {}) {
        return attachPurchaseOrder(insertPurchaseOrder(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.purchaseOrders.find((item) => item.id === where?.id);
        Object.assign(record, data, { updatedAt: now() });
        return attachPurchaseOrder(record, include);
      },
    },
    goodsReceipt: {
      async findMany({ where = {}, include } = {}) {
        return state.goodsReceipts
          .filter((item) => matches(item, where))
          .map((item) => attachGoodsReceipt(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachGoodsReceipt(
          state.goodsReceipts.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async create({ data, include } = {}) {
        return attachGoodsReceipt(insertGoodsReceipt(data), include);
      },
    },
    invoice: {
      async findMany({ where = {}, include } = {}) {
        return state.invoices
          .filter((item) => matches(item, where))
          .map((item) => attachInvoice(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachInvoice(state.invoices.find((item) => matches(item, where)) ?? null, include);
      },
      async findUnique({ where = {}, include } = {}) {
        return attachInvoice(state.invoices.find((item) => matches(item, where)) ?? null, include);
      },
      async create({ data, include } = {}) {
        return attachInvoice(insertInvoice(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.invoices.find((item) => item.id === where?.id);
        Object.assign(record, data, { updatedAt: now() });
        return attachInvoice(record, include);
      },
    },
    invoiceLine: {
      async findMany({ where = {} } = {}) {
        return state.invoiceLines.filter((item) => matches(item, where)).map(clone);
      },
      async createMany({ data } = {}) {
        for (const line of data ?? []) {
          state.invoiceLines.push({
            id: nextId('invoice-line'),
            createdAt: now(),
            updatedAt: now(),
            deletedAt: null,
            ...line,
          });
        }
        return { count: (data ?? []).length };
      },
      async deleteMany({ where = {} } = {}) {
        const before = state.invoiceLines.length;
        state.invoiceLines = state.invoiceLines.filter((item) => !matches(item, where));
        return { count: before - state.invoiceLines.length };
      },
    },
    threeWayMatch: {
      async findFirst({ where = {} } = {}) {
        return clone(state.threeWayMatches.find((item) => matches(item, where)) ?? null);
      },
      async findUnique({ where = {} } = {}) {
        return clone(state.threeWayMatches.find((item) => matches(item, where)) ?? null);
      },
      async create({ data }) {
        return insertThreeWayMatch(data);
      },
      async update({ where, data }) {
        const record = state.threeWayMatches.find((item) => item.id === where?.id);
        Object.assign(record, data, { updatedAt: now() });
        return clone(record);
      },
      async upsert({ where, update, create }) {
        const existing = state.threeWayMatches.find(
          (item) => item.id === where?.id || item.invoiceId === where?.invoiceId,
        );
        if (existing) {
          Object.assign(existing, update, { updatedAt: now() });
          return clone(existing);
        }
        return insertThreeWayMatch(create);
      },
    },
    outboxEvent: {
      async create({ data }) {
        return insertOutboxEvent(data);
      },
      async findMany({ where = {} } = {}) {
        return state.outboxEvents.filter((item) => matches(item, where)).map(clone);
      },
    },
    notification: {
      async create({ data }) {
        return insertNotification(data);
      },
      async createMany({ data } = {}) {
        for (const item of data ?? []) {
          insertNotification(item);
        }
        return { count: (data ?? []).length };
      },
      async findMany({ where = {} } = {}) {
        return state.notifications.filter((item) => matches(item, where)).map(clone);
      },
    },
  });

  const originalAccountFindFirst = base.prisma.account.findFirst?.bind(base.prisma.account);
  base.prisma.account.findFirst = async ({ where = {} } = {}) => {
    const local =
      state.accounts.find((item) => matches(item, where)) ??
      (originalAccountFindFirst ? await originalAccountFindFirst({ where }) : null);
    return clone(local);
  };

  return {
    ...base,
    state,
    insertUser,
    insertVendor,
    insertCustomer,
    insertWarehouse,
    insertPurchaseOrder,
    insertGoodsReceipt,
    insertInvoice,
    insertThreeWayMatch,
    insertOutboxEvent,
    insertNotification,
  };
}
