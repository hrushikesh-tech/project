import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createForecastHarness } from '../helpers/forecast-test-store.mjs';

const require = createRequire(import.meta.url);
const { ForecastingService } = require('../../dist/src/forecasting/forecasting.service.js');
const { ForecastingProcessor } = require('../../dist/src/forecasting/queue/forecasting.processor.js');
const { WEEKLY_RETRAIN_JOB } = require('../../dist/src/forecasting/queue/forecasting.queue.js');

function buildTrainResult(productId, overrides = {}) {
  return {
    trainedModels: [
      {
        id: overrides.id ?? `trained-${productId}`,
        tenantId: 'tenant-1',
        productId,
        modelType: overrides.modelType ?? 'PROPHET',
        version: overrides.version ?? `prophet-${productId}`,
        mape: overrides.mape ?? 12,
        trainingWindowStart: '2025-01-01',
        trainingWindowEnd: '2025-04-30',
        dataPoints: overrides.dataPoints ?? 90,
        artifactUri: overrides.artifactUri ?? `/tmp/${productId}.pkl`,
        metrics: overrides.metrics ?? { source: 'integration-test' },
        trainedAt: '2026-04-20T00:00:00.000Z',
      },
    ],
  };
}

test('weekly retraining promotes only improved models and leaves rejected candidates inactive', async () => {
  const harness = createForecastHarness();
  const sparseProduct = harness.insertSparseHistory({ points: 20, sku: 'SPARSE-20' });
  const promotedProduct = harness.insertSparseHistory({ points: 45, sku: 'PROMOTE-45' });
  const rejectedProduct = harness.insertSparseHistory({ points: 50, sku: 'REJECT-50' });

  harness.insertForecastModel({
    productId: rejectedProduct.id,
    version: 'active-existing',
    mape: '11',
    isActive: true,
    promotedAt: new Date('2026-04-01T00:00:00.000Z'),
  });

  const client = {
    async train({ productId }) {
      if (productId === promotedProduct.id) {
        return buildTrainResult(productId, { version: 'prophet-promoted', mape: 9 });
      }
      if (productId === rejectedProduct.id) {
        return buildTrainResult(productId, { version: 'prophet-rejected', mape: 15 });
      }
      throw new Error(`Unexpected product ${productId}`);
    },
    async predict({ productId, modelType, mape }) {
      return {
        modelType,
        mape,
        generatedAt: '2026-04-21T00:00:00.000Z',
        rows: [
          {
            forecastDate: '2026-05-01',
            predictedDemand: productId === promotedProduct.id ? 21 : 17,
            confidenceLower: 18,
            confidenceUpper: 24,
            horizonDay: 1,
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
  };

  const service = new ForecastingService(harness.prisma, client);
  const processor = new ForecastingProcessor(service);

  const result = await processor.process({
    name: WEEKLY_RETRAIN_JOB,
    data: { tenantId: 'tenant-1' },
  });

  assert.equal(result.trainedProducts, 2);
  assert.equal(result.promotedModels, 1);
  assert.equal(result.rejectedModels, 1);
  assert.equal(result.skippedProducts, 1);

  const promotedModel = harness.state.forecastModels.find(
    (item) => item.productId === promotedProduct.id && item.isActive,
  );
  const rejectedActiveModel = harness.state.forecastModels.find(
    (item) => item.productId === rejectedProduct.id && item.isActive,
  );

  assert.equal(promotedModel.version, 'prophet-promoted');
  assert.equal(Boolean(promotedModel.promotedAt), true);
  assert.equal(rejectedActiveModel.version, 'active-existing');
  assert.equal(harness.state.forecastPredictions.every((item) => item.warehouseId === null), true);
  assert.equal(
    harness.state.forecastPredictions.some(
      (item) => item.productId === promotedProduct.id && item.forecastModelId === promotedModel.id,
    ),
    true,
  );
  assert.equal(
    harness.state.forecastModels.some(
      (item) =>
        item.productId === rejectedProduct.id &&
        item.version === 'prophet-rejected' &&
        item.isActive === false,
    ),
    true,
  );
  assert.equal(
    harness.state.forecastModels.some(
      (item) => item.productId === sparseProduct.id && item.isActive,
    ),
    false,
  );
});
