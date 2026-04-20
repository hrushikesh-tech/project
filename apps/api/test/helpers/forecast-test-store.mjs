import { createRequire } from "node:module";
import { createSupplyChainHarness } from "./supply-chain-test-store.mjs";

const require = createRequire(import.meta.url);
const { Prisma } = require("@amdox/db");
const { InventoryMovementType } = require("@amdox/types");

export function createForecastHarness(options = {}) {
  const base = createSupplyChainHarness(options);
  const state = base.state;

  Object.assign(state, {
    forecastModels: state.forecastModels ?? [],
    forecastPredictions: state.forecastPredictions ?? [],
  });

  let sequence = 1;
  const nextId = (prefix) => `forecast-${prefix}-${sequence++}`;
  const now = () => new Date();
  const clone = (record) => (record ? { ...record } : record);
  const tenantId = options.tenantId ?? state.tenants[0]?.id ?? "tenant-1";

  const normalizeDecimal = (value, fallback = "0") =>
    value instanceof Prisma.Decimal ? value : new Prisma.Decimal(String(value ?? fallback));

  const normalizeDate = (value) => {
    if (value instanceof Date) {
      return value;
    }
    return value ? new Date(value) : null;
  };

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
          compare = normalizeDecimal(leftValue).sub(normalizeDecimal(rightValue)).toNumber();
        } else if (typeof leftValue === "number" || typeof rightValue === "number") {
          compare = Number(leftValue ?? 0) - Number(rightValue ?? 0);
        } else {
          compare = String(leftValue ?? "").localeCompare(String(rightValue ?? ""));
        }

        if (compare !== 0) {
          return direction === "desc" ? -compare : compare;
        }
      }

      return 0;
    });
  };

  const matchesScalar = (actual, expected) => {
    if (expected === undefined) return true;
    if (expected instanceof Prisma.Decimal) {
      return normalizeDecimal(actual).equals(expected);
    }
    if (expected instanceof Date) {
      return normalizeDate(actual)?.getTime() === expected.getTime();
    }
    return actual === expected;
  };

  const matches = (item, where = {}) => {
    if (!where) return true;

    return Object.entries(where).every(([key, value]) => {
      if (value === undefined) {
        return true;
      }

      const actual = item[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if (value.equals !== undefined) {
          return matchesScalar(actual, value.equals);
        }
        if (value.in) {
          return value.in.some((candidate) => matchesScalar(actual, candidate));
        }
        if (value.not !== undefined) {
          return !matchesScalar(actual, value.not);
        }
        if (value.lte !== undefined) {
          return normalizeDecimal(actual).lessThanOrEqualTo(normalizeDecimal(value.lte));
        }
        if (value.gte !== undefined) {
          return normalizeDecimal(actual).greaterThanOrEqualTo(normalizeDecimal(value.gte));
        }
        return true;
      }

      return matchesScalar(actual, value);
    });
  };

  const ensureProductId = (overrides = {}) =>
    overrides.productId ?? state.products[0]?.id ?? base.insertProduct().id;

  const insertForecastModel = (overrides = {}) => {
    const record = {
      id: nextId("model"),
      tenantId,
      productId: ensureProductId(overrides),
      modelType: overrides.modelType ?? "PROPHET",
      version: overrides.version ?? `v${sequence}`,
      mape: normalizeDecimal(overrides.mape ?? "0.12"),
      trainedAt: normalizeDate(overrides.trainedAt) ?? now(),
      trainingWindowStart:
        normalizeDate(overrides.trainingWindowStart) ?? new Date("2025-01-01T00:00:00.000Z"),
      trainingWindowEnd:
        normalizeDate(overrides.trainingWindowEnd) ?? new Date("2025-12-31T00:00:00.000Z"),
      dataPoints: overrides.dataPoints ?? 365,
      artifactUri:
        overrides.artifactUri ??
        `./artifacts/models/${overrides.productId ?? "product"}/${overrides.modelType ?? "prophet"}.json`,
      promotedAt: normalizeDate(overrides.promotedAt),
      isActive: overrides.isActive ?? false,
      hyperparameters: overrides.hyperparameters ?? null,
      metrics: overrides.metrics ?? null,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };

    state.forecastModels.push(record);
    return clone(record);
  };

  const insertForecastPrediction = (overrides = {}) => {
    const record = {
      id: nextId("prediction"),
      tenantId,
      productId: ensureProductId(overrides),
      warehouseId: overrides.warehouseId ?? null,
      forecastDate:
        normalizeDate(overrides.forecastDate) ?? new Date("2026-05-01T00:00:00.000Z"),
      predictedDemand: normalizeDecimal(overrides.predictedDemand ?? "12"),
      confidenceLower:
        overrides.confidenceLower === null
          ? null
          : normalizeDecimal(overrides.confidenceLower ?? "10"),
      confidenceUpper:
        overrides.confidenceUpper === null
          ? null
          : normalizeDecimal(overrides.confidenceUpper ?? "14"),
      modelType: overrides.modelType ?? "PROPHET",
      modelVersion: overrides.modelVersion ?? "v1",
      mape:
        overrides.mape === null ? null : normalizeDecimal(overrides.mape ?? "0.12"),
      forecastModelId: overrides.forecastModelId ?? null,
      generatedAt: normalizeDate(overrides.generatedAt) ?? now(),
      horizonDay: overrides.horizonDay ?? 1,
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };

    state.forecastPredictions.push(record);
    return clone(record);
  };

  const insertInventoryMovement = (overrides = {}) => {
    const productId = ensureProductId(overrides);
    const warehouseId = overrides.warehouseId ?? state.warehouses[0]?.id ?? base.insertWarehouse().id;
    const legalEntityId =
      overrides.legalEntityId ?? state.legalEntities[0]?.id ?? base.insertLegalEntity().id;

    const record = {
      id: nextId("movement"),
      tenantId,
      productId,
      warehouseId,
      legalEntityId,
      costLayerId: overrides.costLayerId ?? null,
      goodsReceiptId: overrides.goodsReceiptId ?? null,
      purchaseOrderId: overrides.purchaseOrderId ?? null,
      movementType: overrides.movementType ?? InventoryMovementType.ISSUE,
      quantity: normalizeDecimal(overrides.quantity ?? "1"),
      unitCost:
        overrides.unitCost === null || overrides.unitCost === undefined
          ? null
          : BigInt(overrides.unitCost),
      referenceType: overrides.referenceType ?? null,
      referenceId: overrides.referenceId ?? null,
      notes: overrides.notes ?? null,
      performedBy: overrides.performedBy ?? null,
      movedAt: normalizeDate(overrides.movedAt) ?? now(),
      createdAt: now(),
      updatedAt: now(),
      deletedAt: null,
      ...overrides,
    };

    state.inventoryMovements.push(record);
    return clone(record);
  };

  const seedDailyHistory = ({ productId, points, baseQuantity = 10, startDate = "2025-01-01T00:00:00.000Z", outlierEvery = null }) => {
    const start = new Date(startDate);
    for (let index = 0; index < points; index += 1) {
      const movedAt = new Date(start);
      movedAt.setUTCDate(start.getUTCDate() + index);
      const quantity =
        outlierEvery && index > 0 && index % outlierEvery === 0
          ? baseQuantity * 8
          : baseQuantity + (index % 5);
      insertInventoryMovement({
        productId,
        quantity,
        movedAt,
        movementType: InventoryMovementType.ISSUE,
      });
    }
  };

  const insertSparseHistory = (overrides = {}) => {
    const product = base.insertProduct({
      sku: overrides.sku ?? `SPARSE-${sequence}`,
      name: overrides.name ?? "Sparse History Product",
      reorderPoint: overrides.reorderPoint ?? 2,
      ...overrides.product,
    });
    seedDailyHistory({
      productId: product.id,
      points: overrides.points ?? 30,
      baseQuantity: overrides.baseQuantity ?? 4,
      startDate: overrides.startDate,
    });
    return product;
  };

  const insertHighVolumeHistory = (overrides = {}) => {
    const product = base.insertProduct({
      sku: overrides.sku ?? `HV-${sequence}`,
      name: overrides.name ?? "High Volume Product",
      reorderPoint: overrides.reorderPoint ?? 5,
      ...overrides.product,
    });
    seedDailyHistory({
      productId: product.id,
      points: overrides.points ?? 540,
      baseQuantity: overrides.baseQuantity ?? 18,
      startDate: overrides.startDate,
    });
    return product;
  };

  const insertOutlierHistory = (overrides = {}) => {
    const product = base.insertProduct({
      sku: overrides.sku ?? `OUTLIER-${sequence}`,
      name: overrides.name ?? "Outlier Product",
      reorderPoint: overrides.reorderPoint ?? 3,
      ...overrides.product,
    });
    seedDailyHistory({
      productId: product.id,
      points: overrides.points ?? 120,
      baseQuantity: overrides.baseQuantity ?? 9,
      startDate: overrides.startDate,
      outlierEvery: overrides.outlierEvery ?? 11,
    });
    return product;
  };

  const insertModelComparison = (overrides = {}) => {
    const productId = overrides.productId ?? ensureProductId();
    const activeModel = insertForecastModel({
      productId,
      modelType: overrides.activeModelType ?? "PROPHET",
      version: overrides.activeVersion ?? "v-current",
      mape: overrides.activeMape ?? "0.18",
      isActive: true,
      promotedAt: overrides.activePromotedAt ?? now(),
    });
    const candidateModel = insertForecastModel({
      productId,
      modelType: overrides.candidateModelType ?? "LSTM",
      version: overrides.candidateVersion ?? "v-candidate",
      mape: overrides.candidateMape ?? "0.14",
      isActive: false,
    });
    return { activeModel, candidateModel };
  };

  Object.assign(base.prisma, {
    forecastModel: {
      async findMany(args = {}) {
        return maybeSort(
          state.forecastModels.filter((record) => matches(record, args.where)),
          args.orderBy,
        ).map(clone);
      },
      async findFirst(args = {}) {
        const [first] = maybeSort(
          state.forecastModels.filter((record) => matches(record, args.where)),
          args.orderBy,
        );
        return clone(first ?? null);
      },
      async findUnique(args = {}) {
        return (
          clone(
            state.forecastModels.find((record) => matches(record, args.where)) ?? null,
          )
        );
      },
      async create({ data }) {
        return insertForecastModel(data);
      },
      async update({ where, data }) {
        const record = state.forecastModels.find((item) => matches(item, where));
        if (!record) {
          throw new Error("Forecast model not found.");
        }
        Object.assign(record, data, { updatedAt: now() });
        return clone(record);
      },
      async updateMany({ where, data }) {
        let count = 0;
        for (const record of state.forecastModels) {
          if (matches(record, where)) {
            Object.assign(record, data, { updatedAt: now() });
            count += 1;
          }
        }
        return { count };
      },
      async count(args = {}) {
        return state.forecastModels.filter((record) => matches(record, args.where)).length;
      },
    },
    forecastPrediction: {
      async findMany(args = {}) {
        return maybeSort(
          state.forecastPredictions.filter((record) => matches(record, args.where)),
          args.orderBy,
        ).map(clone);
      },
      async create({ data }) {
        return insertForecastPrediction(data);
      },
      async createMany({ data }) {
        const records = Array.isArray(data) ? data : [data];
        for (const record of records) {
          insertForecastPrediction(record);
        }
        return { count: records.length };
      },
      async deleteMany({ where } = {}) {
        const before = state.forecastPredictions.length;
        state.forecastPredictions = state.forecastPredictions.filter(
          (record) => !matches(record, where),
        );
        return { count: before - state.forecastPredictions.length };
      },
    },
  });

  return {
    ...base,
    insertForecastModel,
    insertForecastPrediction,
    insertInventoryMovement,
    insertSparseHistory,
    insertHighVolumeHistory,
    insertOutlierHistory,
    insertModelComparison,
  };
}
