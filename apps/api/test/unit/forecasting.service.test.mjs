import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createForecastHarness } from '../helpers/forecast-test-store.mjs';

const require = createRequire(import.meta.url);
const { ForecastingService } = require('../../dist/src/forecasting/forecasting.service.js');
const {
  ForecastPromotionRejected,
  ForecastQualityGateFailed,
  InventoryMovementType,
} = require('@amdox/types');

function createForecastingClient(overrides = {}) {
  return {
    async train() {
      return { trainedModels: [] };
    },
    async predict({ modelType = 'PROPHET', mape = 12 }) {
      return {
        modelType,
        mape,
        generatedAt: '2026-04-21T00:00:00.000Z',
        rows: [
          {
            forecastDate: '2026-05-01',
            predictedDemand: 18,
            confidenceLower: 15,
            confidenceUpper: 21,
            horizonDay: 1,
          },
          {
            forecastDate: '2026-05-02',
            predictedDemand: 19,
            confidenceLower: 16,
            confidenceUpper: 22,
            horizonDay: 2,
          },
        ],
      };
    },
    async listModels() {
      return [];
    },
    async getModelDetails(id) {
      return { id };
    },
    async health() {
      return { status: 'healthy', modelCount: 0, lastTrainingTime: null };
    },
    ...overrides,
  };
}

function createTrainedModel(overrides = {}) {
  return {
    id: overrides.id ?? 'trained-model-1',
    tenantId: 'tenant-1',
    productId: overrides.productId ?? 'product-1',
    modelType: overrides.modelType ?? 'PROPHET',
    version: overrides.version ?? 'prophet-v1',
    mape: overrides.mape ?? 12,
    trainingWindowStart: overrides.trainingWindowStart ?? '2025-01-01',
    trainingWindowEnd: overrides.trainingWindowEnd ?? '2025-04-30',
    dataPoints: overrides.dataPoints ?? 120,
    artifactUri: overrides.artifactUri ?? '/tmp/model.pkl',
    metrics: overrides.metrics ?? { source: 'test' },
    trainedAt: overrides.trainedAt ?? '2026-04-20T00:00:00.000Z',
  };
}

test('aggregateDemandHistory groups InventoryMovementType.ISSUE by product and day only', async () => {
  const harness = createForecastHarness();
  const service = new ForecastingService(harness.prisma, createForecastingClient());
  const productA = harness.insertProduct({ sku: 'FORECAST-A', name: 'Forecast A' });
  const productB = harness.insertProduct({ sku: 'FORECAST-B', name: 'Forecast B' });
  const sameDay = new Date('2026-01-01T10:00:00.000Z');

  harness.insertInventoryMovement({
    productId: productA.id,
    movedAt: sameDay,
    quantity: 3,
    movementType: InventoryMovementType.ISSUE,
  });
  harness.insertInventoryMovement({
    productId: productA.id,
    movedAt: new Date('2026-01-01T16:00:00.000Z'),
    quantity: 5,
    movementType: InventoryMovementType.ISSUE,
  });
  harness.insertInventoryMovement({
    productId: productA.id,
    movedAt: sameDay,
    quantity: 99,
    movementType: 'RECEIPT',
  });
  harness.insertInventoryMovement({
    productId: productA.id,
    movedAt: new Date('2026-01-02T10:00:00.000Z'),
    quantity: 4,
    movementType: InventoryMovementType.ISSUE,
  });
  harness.insertInventoryMovement({
    productId: productB.id,
    movedAt: sameDay,
    quantity: 7,
    movementType: InventoryMovementType.ISSUE,
  });

  const series = await service.aggregateDemandHistory('tenant-1');
  const productASeries = series.find((item) => item.productId === productA.id);
  const productBSeries = series.find((item) => item.productId === productB.id);

  assert.deepEqual(productASeries.demandHistory, [
    { ds: '2026-01-01', y: 8 },
    { ds: '2026-01-02', y: 4 },
  ]);
  assert.deepEqual(productBSeries.demandHistory, [{ ds: '2026-01-01', y: 7 }]);
});

test('persistTrainingResult activates the first acceptable model and writes warehouseId null predictions', async () => {
  const harness = createForecastHarness();
  const product = harness.insertProduct({ sku: 'FIRST-ACTIVE', name: 'First Active' });
  const service = new ForecastingService(harness.prisma, createForecastingClient());

  const promoted = await service.persistTrainingResult('tenant-1', product.id, [
    createTrainedModel({ productId: product.id, mape: 12, version: 'prophet-first' }),
  ]);

  assert.equal(promoted.isActive, true);
  assert.equal(harness.state.forecastModels.filter((item) => item.isActive).length, 1);
  assert.equal(harness.state.forecastPredictions.length, 2);
  assert.equal(harness.state.forecastPredictions.every((item) => item.warehouseId === null), true);
});

test('persistTrainingResult rejects models above the 20 quality gate', async () => {
  const harness = createForecastHarness();
  const product = harness.insertProduct({ sku: 'BAD-MAPE', name: 'Bad Mape' });
  const service = new ForecastingService(harness.prisma, createForecastingClient());

  await assert.rejects(
    () =>
      service.persistTrainingResult('tenant-1', product.id, [
        createTrainedModel({ productId: product.id, mape: 24, version: 'prophet-bad' }),
      ]),
    ForecastQualityGateFailed,
  );

  assert.equal(harness.state.forecastModels.length, 1);
  assert.equal(harness.state.forecastModels[0].isActive, false);
});

test('persistTrainingResult rejects a worse candidate when an active model already exists', async () => {
  const harness = createForecastHarness();
  const product = harness.insertProduct({ sku: 'WORSE-CANDIDATE', name: 'Worse Candidate' });
  harness.insertForecastModel({
    productId: product.id,
    version: 'active-v1',
    mape: '12',
    isActive: true,
    promotedAt: new Date('2026-04-01T00:00:00.000Z'),
  });
  const service = new ForecastingService(harness.prisma, createForecastingClient());

  await assert.rejects(
    () =>
      service.persistTrainingResult('tenant-1', product.id, [
        createTrainedModel({ productId: product.id, mape: 16, version: 'prophet-worse' }),
      ]),
    ForecastPromotionRejected,
  );

  assert.equal(harness.state.forecastModels.filter((item) => item.isActive).length, 1);
  assert.equal(harness.state.forecastPredictions.length, 0);
});

test('persistTrainingResult replaces the active model only when the new model improves mape', async () => {
  const harness = createForecastHarness();
  const product = harness.insertProduct({ sku: 'BETTER-CANDIDATE', name: 'Better Candidate' });
  const activeModel = harness.insertForecastModel({
    productId: product.id,
    version: 'active-v1',
    mape: '18',
    isActive: true,
    promotedAt: new Date('2026-04-01T00:00:00.000Z'),
  });
  const service = new ForecastingService(harness.prisma, createForecastingClient());

  const promoted = await service.persistTrainingResult('tenant-1', product.id, [
    createTrainedModel({
      productId: product.id,
      mape: 14,
      version: 'lstm-better',
      modelType: 'LSTM',
    }),
  ]);

  const currentActive = harness.state.forecastModels.find((item) => item.isActive);
  const previousActive = harness.state.forecastModels.find((item) => item.id === activeModel.id);

  assert.equal(previousActive.isActive, false);
  assert.equal(currentActive.version, 'lstm-better');
  assert.equal(Boolean(currentActive.promotedAt), true);
  assert.equal(promoted.modelType, 'LSTM');
  assert.equal(harness.state.forecastPredictions.every((item) => item.warehouseId === null), true);
});
