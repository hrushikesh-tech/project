import { Injectable } from "@nestjs/common";
import { Prisma } from "@amdox/db";
import {
  ActiveForecastModelNotFound,
  ForecastPromotionRejected,
  ForecastQualityGateFailed,
  InventoryMovementType,
} from "@amdox/types";
import { PrismaService } from "../prisma/prisma.service";
import { ForecastingClient } from "./forecasting.client";
import type { PredictionRow, TrainedModelSummary } from "./forecasting.client";
import { serializeForecastRecord } from "./forecasting.serialization";

const DEFAULT_HORIZON_DAYS = 30;
const DEFAULT_MAX_MAPE_PERCENT = 20;
const MIN_PROPHET_HISTORY_POINTS = 30;

@Injectable()
export class ForecastingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly forecastingClient: ForecastingClient,
  ) {}

  async aggregateDemandHistory(tenantId: string) {
    const db = this.prisma.forTenant(tenantId);
    const movements = await db.inventoryMovement.findMany({
      where: {
        deletedAt: null,
        movementType: InventoryMovementType.ISSUE,
      },
      orderBy: [{ productId: "asc" }, { movedAt: "asc" }],
    });

    return this.groupByProductDay(movements);
  }

  async runWeeklyRetrainingForTenant(tenantId: string) {
    const demandSeries = await this.aggregateDemandHistory(tenantId);
    let trainedProducts = 0;
    let promotedModels = 0;
    let rejectedModels = 0;
    let skippedProducts = 0;

    for (const productHistory of demandSeries) {
      if (productHistory.demandHistory.length < MIN_PROPHET_HISTORY_POINTS) {
        skippedProducts += 1;
        continue;
      }

      const result = await this.forecastingClient.train({
        tenantId,
        productId: productHistory.productId,
        demandHistory: productHistory.demandHistory,
        horizonDays: DEFAULT_HORIZON_DAYS,
      });

      trainedProducts += 1;
      try {
        const promoted = await this.persistTrainingResult(
          tenantId,
          productHistory.productId,
          result.trainedModels,
        );
        if (promoted) {
          promotedModels += 1;
        }
      } catch (error) {
        if (
          error instanceof ForecastPromotionRejected ||
          error instanceof ForecastQualityGateFailed
        ) {
          rejectedModels += 1;
          continue;
        }
        throw error;
      }
    }

    return {
      tenantId,
      trainedProducts,
      promotedModels,
      rejectedModels,
      skippedProducts,
    };
  }

  async persistTrainingResult(
    tenantId: string,
    productId: string,
    trainedModels: TrainedModelSummary[],
  ) {
    if (trainedModels.length === 0) {
      throw new ForecastPromotionRejected("no candidate models were returned");
    }

    const db = this.prisma.forTenant(tenantId);
    const currentActive = await db.forecastModel.findFirst({
      where: {
        tenantId,
        productId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { trainedAt: "desc" },
    });

    const persisted = [];
    for (const trainedModel of trainedModels) {
      const record = await db.forecastModel.create({
        data: {
          tenantId,
          productId,
          modelType: trainedModel.modelType,
          version: trainedModel.version,
          mape: new Prisma.Decimal(String(trainedModel.mape)),
          trainedAt: new Date(trainedModel.trainedAt),
          trainingWindowStart: new Date(trainedModel.trainingWindowStart),
          trainingWindowEnd: new Date(trainedModel.trainingWindowEnd),
          dataPoints: trainedModel.dataPoints,
          artifactUri: trainedModel.artifactUri,
          hyperparameters: null,
          metrics: trainedModel.metrics ?? undefined,
          isActive: false,
        },
      });
      persisted.push(record);
    }

    const acceptable = persisted
      .filter((candidate) => candidate.mape.lte(DEFAULT_MAX_MAPE_PERCENT))
      .sort((left, right) => left.mape.comparedTo(right.mape));

    const bestCandidate = acceptable[0];
    if (!bestCandidate) {
      throw new ForecastQualityGateFailed();
    }

    const activeMape = currentActive ? currentActive.mape : null;
    const canPromote =
      activeMape == null ||
      bestCandidate.mape.lt(activeMape) ||
      !currentActive?.isActive;

    if (!canPromote) {
      throw new ForecastPromotionRejected(
        "candidate MAPE did not improve on the active model",
      );
    }

    await db.forecastModel.updateMany({
      where: {
        tenantId,
        productId,
        isActive: true,
      },
      data: {
        isActive: false,
      },
    });

    const promoted = await db.forecastModel.update({
      where: { id: bestCandidate.id },
      data: {
        isActive: true,
        promotedAt: new Date(),
      },
    });

    await this.refreshPredictionsForModel(tenantId, productId, promoted);
    return serializeForecastRecord(promoted);
  }

  async refreshPredictionsForModel(
    tenantId: string,
    productId: string,
    model: {
      id: string;
      modelType: string;
      artifactUri: string | null;
      mape: Prisma.Decimal;
      version: string;
    },
  ) {
    if (!model.artifactUri) {
      throw new ActiveForecastModelNotFound(productId);
    }

    const db = this.prisma.forTenant(tenantId);
    const predictionResponse = await this.forecastingClient.predict({
      modelId: undefined,
      artifactUri: model.artifactUri,
      tenantId,
      productId,
      modelType: model.modelType,
      mape: model.mape.toNumber(),
      horizonDays: DEFAULT_HORIZON_DAYS,
    });

    await db.forecastPrediction.deleteMany({
      where: {
        tenantId,
        productId,
      },
    });

    await db.forecastPrediction.createMany({
      data: predictionResponse.rows.map((row: PredictionRow) => ({
        tenantId,
        productId,
        warehouseId: null,
        forecastModelId: model.id,
        forecastDate: new Date(row.forecastDate),
        generatedAt: new Date(predictionResponse.generatedAt),
        horizonDay: row.horizonDay,
        predictedDemand: new Prisma.Decimal(String(row.predictedDemand)),
        confidenceLower:
          row.confidenceLower == null
            ? null
            : new Prisma.Decimal(String(row.confidenceLower)),
        confidenceUpper:
          row.confidenceUpper == null
            ? null
            : new Prisma.Decimal(String(row.confidenceUpper)),
        modelType: predictionResponse.modelType,
        modelVersion: model.version,
        mape: new Prisma.Decimal(String(predictionResponse.mape)),
      })),
    });
  }

  async predictForProduct(tenantId: string, productId: string) {
    const db = this.prisma.forTenant(tenantId);
    const activeModel = await db.forecastModel.findFirst({
      where: {
        tenantId,
        productId,
        isActive: true,
        deletedAt: null,
      },
      orderBy: { promotedAt: "desc" },
    });

    if (!activeModel?.artifactUri) {
      throw new ActiveForecastModelNotFound(productId);
    }

    return this.forecastingClient.predict({
      artifactUri: activeModel.artifactUri,
      tenantId,
      productId,
      modelType: activeModel.modelType,
      mape: activeModel.mape.toNumber(),
      horizonDays: DEFAULT_HORIZON_DAYS,
    });
  }

  async health() {
    return this.forecastingClient.health();
  }

  async listModels() {
    return this.forecastingClient.listModels();
  }

  async getModelDetails(modelId: string) {
    return this.forecastingClient.getModelDetails(modelId);
  }

  private groupByProductDay(
    movements: Array<{
      productId: string;
      movedAt: Date;
      quantity: Prisma.Decimal;
    }>,
  ) {
    const grouped = new Map<
      string,
      {
        productId: string;
        demandHistory: { ds: string; y: number }[];
      }
    >();

    for (const movement of movements) {
      const bucket = grouped.get(movement.productId) ?? {
        productId: movement.productId,
        demandHistory: [],
      };
      const day = movement.movedAt.toISOString().slice(0, 10);
      const existingPoint = bucket.demandHistory.find(
        (point) => point.ds === day,
      );
      const quantity = new Prisma.Decimal(
        movement.quantity.toString(),
      ).toNumber();
      if (existingPoint) {
        existingPoint.y += quantity;
      } else {
        bucket.demandHistory.push({ ds: day, y: quantity });
      }
      grouped.set(movement.productId, bucket);
    }

    for (const bucket of grouped.values()) {
      bucket.demandHistory.sort((left, right) =>
        left.ds.localeCompare(right.ds),
      );
    }

    return [...grouped.values()];
  }
}
