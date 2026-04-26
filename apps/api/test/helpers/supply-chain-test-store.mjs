import { createRequire } from 'node:module';
import { createAparHarness } from './apar-test-store.mjs';
import { Prisma } from './prisma-client.mjs';

const require = createRequire(import.meta.url);

export function createSupplyChainHarness(options = {}) {
  const base = createAparHarness(options);
  const state = base.state;

  Object.assign(state, {
    products: state.products ?? [],
    productReplenishmentSettings: state.productReplenishmentSettings ?? [],
    inventoryItems: state.inventoryItems ?? [],
    costLayers: state.costLayers ?? [],
    inventoryMovements: state.inventoryMovements ?? [],
  });

  let sequence = 1;
  const nextId = (prefix) => `sc-${prefix}-${sequence++}`;
  const now = () => new Date();
  const clone = (record) => (record ? { ...record } : record);

  const maybeSort = (items, orderBy) => {
    const orders = Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : [];
    if (orders.length === 0) {
      return items;
    }

    return [...items].sort((left, right) => {
      for (const order of orders) {
        const [field, direction] = Object.entries(order)[0];
        const leftValue = left[field];
        const rightValue = right[field];
        let compare = 0;

        if (leftValue instanceof Date && rightValue instanceof Date) {
          compare = leftValue.getTime() - rightValue.getTime();
        } else if (
          leftValue instanceof Prisma.Decimal ||
          rightValue instanceof Prisma.Decimal
        ) {
          compare = new Prisma.Decimal(String(leftValue ?? 0))
            .sub(new Prisma.Decimal(String(rightValue ?? 0)))
            .toNumber();
        } else if (typeof leftValue === 'bigint' || typeof rightValue === 'bigint') {
          compare = Number(BigInt(leftValue ?? 0) - BigInt(rightValue ?? 0));
        } else {
          compare = String(leftValue ?? '').localeCompare(String(rightValue ?? ''));
        }

        if (compare !== 0) {
          return direction === 'desc' ? -compare : compare;
        }
      }
      return 0;
    });
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
        if (Object.prototype.hasOwnProperty.call(value, 'not')) {
          if (item[key] === value.not) {
            return false;
          }
          continue;
        }
        if (value.lte && !(item[key] <= value.lte)) {
          return false;
        }
        if (value.gte && !(item[key] >= value.gte)) {
          return false;
        }
        if (value.lt && !(item[key] < value.lt)) {
          return false;
        }
        if (value.gt && !(item[key] > value.gt)) {
          return false;
        }
        continue;
      }

      if (item[key] !== value) {
        return false;
      }
    }

    return true;
  };

  const ensureTenantId = () => state.tenants[0]?.id ?? options.tenantId ?? 'tenant-1';

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
    return base.insertVendor({ legalEntityId: ensureLegalEntityId(overrides) }).id;
  };

  const ensureWarehouseId = (overrides = {}) => {
    if (overrides.warehouseId) {
      return overrides.warehouseId;
    }
    if (state.warehouses[0]?.id) {
      return state.warehouses[0].id;
    }
    return base.insertWarehouse().id;
  };

  const ensureProductId = (overrides = {}) => {
    if (overrides.productId) {
      return overrides.productId;
    }
    if (state.products[0]?.id) {
      return state.products[0].id;
    }
    return insertProduct().id;
  };

  const attachProduct = (record) => clone(record);
  const attachWarehouse = (record) => clone(record);
  const attachVendor = (record) => clone(record);
  const attachLegalEntity = (record) => clone(record);

  const attachPurchaseOrderLine = (record, include = {}) => {
    if (!record) return null;

    const output = clone(record);
    if (include.product) {
      output.product = attachProduct(
        state.products.find((item) => item.id === record.productId) ?? null,
      );
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
        .map((item) => attachGoodsReceiptLine(item, include.lines.include));
    }
    if (include.legalEntity) {
      output.legalEntity = attachLegalEntity(
        state.legalEntities.find((item) => item.id === record.legalEntityId) ?? null,
      );
    }
    if (include.warehouse) {
      output.warehouse = attachWarehouse(
        state.warehouses.find((item) => item.id === record.warehouseId) ?? null,
      );
    }
    return output;
  };

  const attachGoodsReceiptLine = (record, include = {}) => {
    if (!record) return null;

    const output = clone(record);
    if (include.purchaseOrderLine) {
      output.purchaseOrderLine = attachPurchaseOrderLine(
        state.purchaseOrderLines.find((item) => item.id === record.purchaseOrderLineId) ?? null,
        include.purchaseOrderLine.include,
      );
    }
    return output;
  };

  const attachPurchaseOrder = (record, include = {}) => {
    if (!record) return null;

    const output = clone(record);
    if (include.vendor) {
      output.vendor = attachVendor(
        state.vendors.find((item) => item.id === record.vendorId) ?? null,
      );
    }
    if (include.legalEntity) {
      output.legalEntity = attachLegalEntity(
        state.legalEntities.find((item) => item.id === record.legalEntityId) ?? null,
      );
    }
    if (include.lines) {
      output.lines = state.purchaseOrderLines
        .filter((item) => item.purchaseOrderId === record.id)
        .map((item) => attachPurchaseOrderLine(item, include.lines.include));
    }
    if (include.goodsReceipts) {
      output.goodsReceipts = state.goodsReceipts
        .filter((item) => item.purchaseOrderId === record.id)
        .map((item) => attachGoodsReceipt(item, include.goodsReceipts.include));
    }
    return output;
  };

  const attachReplenishment = (record, include = {}) => {
    if (!record) return null;

    const output = clone(record);
    if (include.product) {
      output.product = attachProduct(
        state.products.find((item) => item.id === record.productId) ?? null,
      );
    }
    if (include.vendor) {
      output.vendor = attachVendor(
        state.vendors.find((item) => item.id === record.vendorId) ?? null,
      );
    }
    if (include.legalEntity) {
      output.legalEntity = attachLegalEntity(
        state.legalEntities.find((item) => item.id === record.legalEntityId) ?? null,
      );
    }
    return output;
  };

  const attachInventoryItem = (record, include = {}) => {
    if (!record) return null;

    const output = clone(record);
    if (include.product) {
      output.product = attachProduct(
        state.products.find((item) => item.id === record.productId) ?? null,
      );
    }
    if (include.warehouse) {
      output.warehouse = attachWarehouse(
        state.warehouses.find((item) => item.id === record.warehouseId) ?? null,
      );
    }
    return output;
  };

  const attachCostLayer = (record, include = {}) => {
    if (!record) return null;

    const output = clone(record);
    if (include.product) {
      output.product = attachProduct(
        state.products.find((item) => item.id === record.productId) ?? null,
      );
    }
    if (include.warehouse) {
      output.warehouse = attachWarehouse(
        state.warehouses.find((item) => item.id === record.warehouseId) ?? null,
      );
    }
    return output;
  };

  const attachInventoryMovement = (record, include = {}) => {
    if (!record) return null;

    const output = clone(record);
    if (include.product) {
      output.product = attachProduct(
        state.products.find((item) => item.id === record.productId) ?? null,
      );
    }
    if (include.warehouse) {
      output.warehouse = attachWarehouse(
        state.warehouses.find((item) => item.id === record.warehouseId) ?? null,
      );
    }
    if (include.costLayer) {
      output.costLayer = attachCostLayer(
        state.costLayers.find((item) => item.id === record.costLayerId) ?? null,
        include.costLayer.include,
      );
    }
    if (include.goodsReceipt) {
      output.goodsReceipt = attachGoodsReceipt(
        state.goodsReceipts.find((item) => item.id === record.goodsReceiptId) ?? null,
        include.goodsReceipt.include,
      );
    }
    if (include.purchaseOrder) {
      output.purchaseOrder = attachPurchaseOrder(
        state.purchaseOrders.find((item) => item.id === record.purchaseOrderId) ?? null,
        include.purchaseOrder.include,
      );
    }
    if (include.legalEntity) {
      output.legalEntity = attachLegalEntity(
        state.legalEntities.find((item) => item.id === record.legalEntityId) ?? null,
      );
    }
    return output;
  };

  const insertProduct = (overrides = {}) => {
    const record = {
      id: nextId('product'),
      tenantId: ensureTenantId(),
      sku: overrides.sku ?? `SKU-${sequence}`,
      name: overrides.name ?? `Product ${sequence}`,
      description: overrides.description ?? null,
      category: overrides.category ?? null,
      unitOfMeasure: overrides.unitOfMeasure ?? 'PCS',
      reorderPoint:
        overrides.reorderPoint instanceof Prisma.Decimal
          ? overrides.reorderPoint
          : new Prisma.Decimal(String(overrides.reorderPoint ?? 0)),
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.products.push(record);
    return attachProduct(record);
  };

  const insertWarehouse = (overrides = {}) => {
    return base.insertWarehouse(overrides);
  };

  const insertReplenishmentSetting = (overrides = {}) => {
    const record = {
      id: nextId('replenishment'),
      tenantId: ensureTenantId(),
      productId: ensureProductId(overrides),
      legalEntityId: ensureLegalEntityId(overrides),
      vendorId: ensureVendorId(overrides),
      reorderQuantity:
        overrides.reorderQuantity instanceof Prisma.Decimal
          ? overrides.reorderQuantity
          : new Prisma.Decimal(String(overrides.reorderQuantity ?? 1)),
      isAutoReorderEnabled: overrides.isAutoReorderEnabled ?? true,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.productReplenishmentSettings.push(record);
    return attachReplenishment(record);
  };

  const insertPurchaseOrder = (overrides = {}) => {
    const record = {
      id: nextId('po'),
      tenantId: ensureTenantId(),
      legalEntityId: ensureLegalEntityId(overrides),
      vendorId: ensureVendorId(overrides),
      poNumber: overrides.poNumber ?? `PO-${sequence}`,
      status: overrides.status ?? 'DRAFT',
      totalAmount: BigInt(overrides.totalAmount ?? 0),
      currency: overrides.currency ?? 'INR',
      expectedDelivery: overrides.expectedDelivery ?? null,
      submittedAt: overrides.submittedAt ?? null,
      approvedBy: overrides.approvedBy ?? null,
      approvedAt: overrides.approvedAt ?? null,
      rejectedAt: overrides.rejectedAt ?? null,
      rejectedReason: overrides.rejectedReason ?? null,
      sentToVendorAt: overrides.sentToVendorAt ?? null,
      closedAt: overrides.closedAt ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };

    delete record.lines;
    state.purchaseOrders.push(record);

    for (const line of overrides.lines ?? []) {
      state.purchaseOrderLines.push({
        id: nextId('po-line'),
        tenantId: record.tenantId,
        purchaseOrderId: record.id,
        productId: line.productId ?? ensureProductId(line),
        description: line.description ?? 'Seed PO line',
        quantity:
          line.quantity instanceof Prisma.Decimal
            ? line.quantity
            : new Prisma.Decimal(String(line.quantity ?? 1)),
        unitPrice: BigInt(line.unitPrice ?? 0),
        receivedQuantity:
          line.receivedQuantity instanceof Prisma.Decimal
            ? line.receivedQuantity
            : new Prisma.Decimal(String(line.receivedQuantity ?? 0)),
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null,
        ...line,
      });
    }

    return attachPurchaseOrder(record);
  };

  const insertGoodsReceipt = (overrides = {}) => {
    const purchaseOrderId =
      overrides.purchaseOrderId ?? state.purchaseOrders[0]?.id ?? insertPurchaseOrder(overrides).id;
    const purchaseOrder = state.purchaseOrders.find((item) => item.id === purchaseOrderId);
    const record = {
      id: nextId('gr'),
      tenantId: ensureTenantId(),
      purchaseOrderId,
      legalEntityId: overrides.legalEntityId ?? purchaseOrder?.legalEntityId ?? ensureLegalEntityId(overrides),
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
          line.purchaseOrderLineId ??
          state.purchaseOrderLines.find((item) => item.purchaseOrderId === purchaseOrderId)?.id ??
          nextId('po-line-ref'),
        quantityReceived:
          line.quantityReceived instanceof Prisma.Decimal
            ? line.quantityReceived
            : new Prisma.Decimal(String(line.quantityReceived ?? 1)),
        createdAt: now(),
        updatedAt: now(),
        deletedAt: null,
        ...line,
      });
    }

    return attachGoodsReceipt(record);
  };

  const insertInventoryItem = (overrides = {}) => {
    const record = {
      id: nextId('inventory'),
      tenantId: ensureTenantId(),
      productId: ensureProductId(overrides),
      warehouseId: ensureWarehouseId(overrides),
      quantity:
        overrides.quantity instanceof Prisma.Decimal
          ? overrides.quantity
          : new Prisma.Decimal(String(overrides.quantity ?? 0)),
      reservedQuantity:
        overrides.reservedQuantity instanceof Prisma.Decimal
          ? overrides.reservedQuantity
          : new Prisma.Decimal(String(overrides.reservedQuantity ?? 0)),
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.inventoryItems.push(record);
    return attachInventoryItem(record);
  };

  const insertCostLayer = (overrides = {}) => {
    const record = {
      id: nextId('cost-layer'),
      tenantId: ensureTenantId(),
      productId: ensureProductId(overrides),
      warehouseId: ensureWarehouseId(overrides),
      quantity:
        overrides.quantity instanceof Prisma.Decimal
          ? overrides.quantity
          : new Prisma.Decimal(String(overrides.quantity ?? 0)),
      unitCost: BigInt(overrides.unitCost ?? 0),
      remainingQuantity:
        overrides.remainingQuantity instanceof Prisma.Decimal
          ? overrides.remainingQuantity
          : new Prisma.Decimal(
              String(overrides.remainingQuantity ?? overrides.quantity ?? 0),
            ),
      receivedAt: overrides.receivedAt ?? now(),
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.costLayers.push(record);
    return attachCostLayer(record);
  };

  const insertInventoryMovement = (overrides = {}) => {
    const record = {
      id: nextId('inventory-movement'),
      tenantId: ensureTenantId(),
      movementType: overrides.movementType ?? 'RECEIPT',
      productId: ensureProductId(overrides),
      warehouseId: ensureWarehouseId(overrides),
      legalEntityId: overrides.legalEntityId ?? null,
      costLayerId: overrides.costLayerId ?? null,
      goodsReceiptId: overrides.goodsReceiptId ?? null,
      purchaseOrderId: overrides.purchaseOrderId ?? null,
      quantity:
        overrides.quantity instanceof Prisma.Decimal
          ? overrides.quantity
          : new Prisma.Decimal(String(overrides.quantity ?? 0)),
      unitCost:
        overrides.unitCost === undefined || overrides.unitCost === null
          ? null
          : BigInt(overrides.unitCost),
      referenceType: overrides.referenceType ?? null,
      referenceId: overrides.referenceId ?? null,
      notes: overrides.notes ?? null,
      performedBy: overrides.performedBy ?? null,
      movedAt: overrides.movedAt ?? now(),
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };
    state.inventoryMovements.push(record);
    return attachInventoryMovement(record);
  };

  Object.assign(base.prisma, {
    forTenant() {
      return base.prisma;
    },
    product: {
      async findMany({ where = {}, orderBy, include } = {}) {
        return maybeSort(
          state.products.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachProduct(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachProduct(state.products.find((item) => matches(item, where)) ?? null, include);
      },
      async create({ data, include } = {}) {
        return attachProduct(insertProduct(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.products.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return attachProduct(record, include);
      },
    },
    warehouse: {
      async findMany({ where = {}, orderBy, include } = {}) {
        return maybeSort(
          state.warehouses.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachWarehouse(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachWarehouse(state.warehouses.find((item) => matches(item, where)) ?? null, include);
      },
      async create({ data, include } = {}) {
        return attachWarehouse(insertWarehouse(data), include);
      },
    },
    vendor: {
      async findMany({ where = {}, orderBy, include } = {}) {
        return maybeSort(
          state.vendors.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => {
          const output = clone(item);
          if (include?.legalEntity) {
            output.legalEntity = attachLegalEntity(
              state.legalEntities.find((entity) => entity.id === item.legalEntityId) ?? null,
            );
          }
          return output;
        });
      },
      async findFirst({ where = {}, include } = {}) {
        const record = state.vendors.find((item) => matches(item, where)) ?? null;
        if (!record) {
          return null;
        }
        const output = clone(record);
        if (include?.legalEntity) {
          output.legalEntity = attachLegalEntity(
            state.legalEntities.find((entity) => entity.id === record.legalEntityId) ?? null,
          );
        }
        return output;
      },
      async create({ data, include } = {}) {
        const record = base.insertVendor(data);
        if (include?.legalEntity) {
          record.legalEntity = attachLegalEntity(
            state.legalEntities.find((entity) => entity.id === record.legalEntityId) ?? null,
          );
        }
        return record;
      },
      async update({ where, data, include } = {}) {
        const record = state.vendors.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        const output = clone(record);
        if (include?.legalEntity) {
          output.legalEntity = attachLegalEntity(
            state.legalEntities.find((entity) => entity.id === record.legalEntityId) ?? null,
          );
        }
        return output;
      },
    },
    productReplenishmentSetting: {
      async findMany({ where = {}, orderBy, include } = {}) {
        return maybeSort(
          state.productReplenishmentSettings.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachReplenishment(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachReplenishment(
          state.productReplenishmentSettings.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async findUnique({ where = {}, include } = {}) {
        const key = where?.tenantId_productId_legalEntityId;
        const record = key
          ? state.productReplenishmentSettings.find(
              (item) =>
                item.tenantId === key.tenantId &&
                item.productId === key.productId &&
                item.legalEntityId === key.legalEntityId,
            ) ?? null
          : state.productReplenishmentSettings.find((item) => matches(item, where)) ?? null;
        return attachReplenishment(record, include);
      },
      async upsert({ where, create, update, include } = {}) {
        const key = where?.tenantId_productId_legalEntityId;
        let record =
          state.productReplenishmentSettings.find(
            (item) =>
              item.tenantId === key?.tenantId &&
              item.productId === key?.productId &&
              item.legalEntityId === key?.legalEntityId,
          ) ?? null;

        if (record) {
          Object.assign(record, update, { updatedAt: now() });
          return attachReplenishment(record, include);
        }

        record = insertReplenishmentSetting(create);
        return attachReplenishment(record, include);
      },
    },
    purchaseOrder: {
      async findMany({ where = {}, include, orderBy } = {}) {
        let items = state.purchaseOrders.filter((item) => matches(item, where));
        if (where?.lines?.some) {
          items = items.filter((item) =>
            state.purchaseOrderLines.some(
              (line) =>
                line.purchaseOrderId === item.id &&
                matches(line, where.lines.some),
            ),
          );
        }
        return maybeSort(items, orderBy).map((item) => attachPurchaseOrder(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        let items = state.purchaseOrders.filter((item) => matches(item, where));
        if (where?.lines?.some) {
          items = items.filter((item) =>
            state.purchaseOrderLines.some(
              (line) =>
                line.purchaseOrderId === item.id &&
                matches(line, where.lines.some),
            ),
          );
        }
        return attachPurchaseOrder(items[0] ?? null, include);
      },
      async create({ data, include } = {}) {
        return attachPurchaseOrder(insertPurchaseOrder(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.purchaseOrders.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return attachPurchaseOrder(record, include);
      },
    },
    purchaseOrderLine: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return maybeSort(
          state.purchaseOrderLines.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachPurchaseOrderLine(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachPurchaseOrderLine(
          state.purchaseOrderLines.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async createMany({ data } = {}) {
        for (const line of data ?? []) {
          state.purchaseOrderLines.push({
            id: nextId('po-line'),
            tenantId: ensureTenantId(),
            quantity: new Prisma.Decimal(String(line.quantity ?? 0)),
            unitPrice: BigInt(line.unitPrice ?? 0),
            receivedQuantity: new Prisma.Decimal(String(line.receivedQuantity ?? 0)),
            createdAt: now(),
            updatedAt: now(),
            deletedAt: null,
            ...line,
          });
        }
        return { count: (data ?? []).length };
      },
      async deleteMany({ where = {} } = {}) {
        const before = state.purchaseOrderLines.length;
        state.purchaseOrderLines = state.purchaseOrderLines.filter(
          (item) => !matches(item, where),
        );
        return { count: before - state.purchaseOrderLines.length };
      },
      async update({ where, data, include } = {}) {
        const record = state.purchaseOrderLines.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return attachPurchaseOrderLine(record, include);
      },
    },
    goodsReceipt: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return maybeSort(
          state.goodsReceipts.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachGoodsReceipt(item, include));
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
    goodsReceiptLine: {
      async findMany({ where = {}, include } = {}) {
        return state.goodsReceiptLines
          .filter((item) => matches(item, where))
          .map((item) => attachGoodsReceiptLine(item, include));
      },
      async createMany({ data } = {}) {
        for (const line of data ?? []) {
          state.goodsReceiptLines.push({
            id: nextId('gr-line'),
            tenantId: ensureTenantId(),
            quantityReceived: new Prisma.Decimal(String(line.quantityReceived ?? 0)),
            createdAt: now(),
            updatedAt: now(),
            deletedAt: null,
            ...line,
          });
        }
        return { count: (data ?? []).length };
      },
    },
    inventoryItem: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return maybeSort(
          state.inventoryItems.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachInventoryItem(item, include));
      },
      async findFirst({ where = {}, include } = {}) {
        return attachInventoryItem(
          state.inventoryItems.find((item) => matches(item, where)) ?? null,
          include,
        );
      },
      async upsert({ where, create, update, include } = {}) {
        const key = where?.tenantId_productId_warehouseId;
        let record =
          state.inventoryItems.find(
            (item) =>
              item.tenantId === key?.tenantId &&
              item.productId === key?.productId &&
              item.warehouseId === key?.warehouseId,
          ) ?? null;

        if (record) {
          Object.assign(record, update, { updatedAt: now() });
          return attachInventoryItem(record, include);
        }

        record = insertInventoryItem(create);
        return attachInventoryItem(record, include);
      },
      async update({ where, data, include } = {}) {
        const record = state.inventoryItems.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return attachInventoryItem(record, include);
      },
      async create({ data, include } = {}) {
        return attachInventoryItem(insertInventoryItem(data), include);
      },
    },
    costLayer: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return maybeSort(
          state.costLayers.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachCostLayer(item, include));
      },
      async create({ data, include } = {}) {
        return attachCostLayer(insertCostLayer(data), include);
      },
      async update({ where, data, include } = {}) {
        const record = state.costLayers.find((item) => matches(item, where));
        Object.assign(record, data, { updatedAt: now() });
        return attachCostLayer(record, include);
      },
    },
    inventoryMovement: {
      async findMany({ where = {}, include, orderBy } = {}) {
        return maybeSort(
          state.inventoryMovements.filter((item) => matches(item, where)),
          orderBy,
        ).map((item) => attachInventoryMovement(item, include));
      },
      async create({ data, include } = {}) {
        return attachInventoryMovement(insertInventoryMovement(data), include);
      },
      async createMany({ data } = {}) {
        for (const movement of data ?? []) {
          insertInventoryMovement(movement);
        }
        return { count: (data ?? []).length };
      },
    },
  });

  return {
    ...base,
    state,
    insertProduct,
    insertWarehouse,
    insertReplenishmentSetting,
    insertPurchaseOrder,
    insertGoodsReceipt,
    insertInventoryItem,
    insertCostLayer,
    insertInventoryMovement,
  };
}

export function seedInventoryHarness(harness, overrides = {}) {
  const legalEntity =
    overrides.legalEntity ??
    harness.insertLegalEntity({
      code: overrides.legalEntityCode ?? 'SC',
      name: overrides.legalEntityName ?? 'Supply Chain Test Entity',
      baseCurrency: overrides.baseCurrency ?? 'INR',
    });
  const vendor =
    overrides.vendor ??
    harness.insertVendor({
      legalEntityId: legalEntity.id,
      name: overrides.vendorName ?? 'Seed Vendor',
      code: overrides.vendorCode ?? 'VENDOR-001',
    });
  const warehouse =
    overrides.warehouse ??
    harness.insertWarehouse({
      name: overrides.warehouseName ?? 'Main Warehouse',
      code: overrides.warehouseCode ?? 'WH-MAIN',
    });
  const product =
    overrides.product ??
    harness.insertProduct({
      sku: overrides.sku ?? 'SKU-001',
      name: overrides.productName ?? 'Seed Product',
      reorderPoint: overrides.reorderPoint ?? 10,
    });
  const replenishment =
    overrides.replenishment ??
    harness.insertReplenishmentSetting({
      legalEntityId: legalEntity.id,
      vendorId: vendor.id,
      productId: product.id,
      reorderQuantity: overrides.reorderQuantity ?? 25,
    });
  const purchaseOrder =
    overrides.purchaseOrder ??
    harness.insertPurchaseOrder({
      legalEntityId: legalEntity.id,
      vendorId: vendor.id,
      status: overrides.purchaseOrderStatus ?? 'APPROVED',
      lines: [
        {
          productId: product.id,
          quantity: overrides.purchaseOrderQuantity ?? 25,
          unitPrice: overrides.purchaseOrderUnitPrice ?? 1000,
        },
      ],
    });
  const goodsReceipt =
    overrides.goodsReceipt ??
    harness.insertGoodsReceipt({
      legalEntityId: legalEntity.id,
      warehouseId: warehouse.id,
      purchaseOrderId: purchaseOrder.id,
      lines: [
        {
          purchaseOrderLineId: harness.state.purchaseOrderLines[0]?.id,
          quantityReceived: overrides.receiptQuantity ?? 25,
        },
      ],
    });
  const inventoryItem =
    overrides.inventoryItem ??
    harness.insertInventoryItem({
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: overrides.onHandQuantity ?? 25,
    });
  const costLayer =
    overrides.costLayer ??
    harness.insertCostLayer({
      productId: product.id,
      warehouseId: warehouse.id,
      quantity: overrides.costLayerQuantity ?? 25,
      remainingQuantity: overrides.remainingQuantity ?? 25,
      unitCost: overrides.costPerUnit ?? 1000,
    });
  const movement =
    overrides.movement ??
    harness.insertInventoryMovement({
      legalEntityId: legalEntity.id,
      productId: product.id,
      warehouseId: warehouse.id,
      purchaseOrderId: purchaseOrder.id,
      goodsReceiptId: goodsReceipt.id,
      costLayerId: costLayer.id,
      quantity: overrides.movementQuantity ?? 25,
      unitCost: overrides.costPerUnit ?? 1000,
    });

  return {
    legalEntity,
    vendor,
    warehouse,
    product,
    replenishment,
    purchaseOrder,
    goodsReceipt,
    inventoryItem,
    costLayer,
    movement,
  };
}
