import { Injectable, Logger, OnApplicationShutdown, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@amdox/db';
import Redis from 'ioredis';
import { MissingFxRateException } from '@amdox/types';
import { Cron, CronExpression } from '../common/schedule/schedule';
import { PrismaService } from '../prisma/prisma.service';

type FxRateRequest = {
  tenantId: string;
  baseCurrency: string;
  targetCurrency: string;
  effectiveDate: Date;
};

@Injectable()
export class FxRatesService implements OnModuleDestroy, OnApplicationShutdown {
  private readonly logger = new Logger(FxRatesService.name);
  private redis: Redis | null = null;
  private redisDisabled = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async refreshConfiguredRates() {
    const tenants = await this.prisma.raw.tenant.findMany({
      select: { id: true },
    });

    if (tenants.length === 0) {
      return;
    }

    const bases = this.readCurrencyList('OPENEXCHANGE_BASE_CURRENCIES', ['USD']);
    const targets = this.readCurrencyList('OPENEXCHANGE_TARGET_CURRENCIES', ['INR', 'USD', 'EUR']);

    for (const tenant of tenants) {
      for (const baseCurrency of bases) {
        for (const targetCurrency of targets) {
          if (baseCurrency === targetCurrency) {
            continue;
          }

          try {
            await this.fetchAndPersistRate({
              tenantId: tenant.id,
              baseCurrency,
              targetCurrency,
              effectiveDate: new Date(),
            });
          } catch (error) {
            this.logger.warn(
              `Skipping scheduled FX refresh for ${baseCurrency}/${targetCurrency}: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      }
    }
  }

  async getRate(request: FxRateRequest): Promise<Prisma.Decimal> {
    if (request.baseCurrency === request.targetCurrency) {
      return new Prisma.Decimal(1);
    }

    const normalizedDate = this.normalizeDate(request.effectiveDate);
    const cacheKey = this.buildCacheKey(
      request.tenantId,
      request.baseCurrency,
      request.targetCurrency,
      normalizedDate,
    );

    const cached = await this.getCachedRate(cacheKey);
    if (cached) {
      return cached;
    }

    const stored = await this.prisma.raw.fxRate.findFirst({
      where: {
        tenantId: request.tenantId,
        baseCurrency: request.baseCurrency,
        targetCurrency: request.targetCurrency,
        effectiveDate: normalizedDate,
      },
    });

    if (stored) {
      await this.setCachedRate(cacheKey, stored.rate);
      return stored.rate;
    }

    return this.fetchAndPersistRate({
      ...request,
      effectiveDate: normalizedDate,
    });
  }

  private async fetchAndPersistRate(request: FxRateRequest): Promise<Prisma.Decimal> {
    const appId = this.configService.get<string>('OPENEXCHANGE_APP_ID');
    if (!appId) {
      throw new MissingFxRateException('OPENEXCHANGE_APP_ID is not configured.');
    }

    const normalizedDate = this.normalizeDate(request.effectiveDate);
    const datePart = normalizedDate.toISOString().slice(0, 10);
    const endpoint = `https://openexchangerates.org/api/historical/${datePart}.json?app_id=${appId}&symbols=${request.baseCurrency},${request.targetCurrency}`;
    const response = await fetch(endpoint);

    if (!response.ok) {
      throw new MissingFxRateException(
        `OpenExchangeRates lookup failed for ${request.baseCurrency}/${request.targetCurrency}.`,
      );
    }

    const payload = (await response.json()) as {
      rates?: Record<string, number>;
      base?: string;
    };
    const rate = this.deriveRate(
      payload.base ?? 'USD',
      payload.rates ?? {},
      request.baseCurrency,
      request.targetCurrency,
    );

    const persisted = await this.prisma.raw.fxRate.upsert({
      where: {
        tenantId_baseCurrency_targetCurrency_effectiveDate: {
          tenantId: request.tenantId,
          baseCurrency: request.baseCurrency,
          targetCurrency: request.targetCurrency,
          effectiveDate: normalizedDate,
        },
      },
      update: {
        rate,
        source: 'openexchangerates',
      },
      create: {
        tenantId: request.tenantId,
        baseCurrency: request.baseCurrency,
        targetCurrency: request.targetCurrency,
        effectiveDate: normalizedDate,
        rate,
        source: 'openexchangerates',
      },
    });

    await this.setCachedRate(
      this.buildCacheKey(
        request.tenantId,
        request.baseCurrency,
        request.targetCurrency,
        normalizedDate,
      ),
      persisted.rate,
    );

    return persisted.rate;
  }

  private deriveRate(
    responseBaseCurrency: string,
    responseRates: Record<string, number>,
    requestedBaseCurrency: string,
    requestedTargetCurrency: string,
  ): Prisma.Decimal {
    if (requestedBaseCurrency === responseBaseCurrency) {
      const direct = responseRates[requestedTargetCurrency];
      if (!direct) {
        throw new MissingFxRateException(
          `No FX rate returned for ${requestedBaseCurrency}/${requestedTargetCurrency}.`,
        );
      }

      return new Prisma.Decimal(direct);
    }

    const baseRate = requestedBaseCurrency === responseBaseCurrency ? 1 : responseRates[requestedBaseCurrency];
    const targetRate =
      requestedTargetCurrency === responseBaseCurrency ? 1 : responseRates[requestedTargetCurrency];

    if (!baseRate || !targetRate) {
      throw new MissingFxRateException(
        `No FX rate returned for ${requestedBaseCurrency}/${requestedTargetCurrency}.`,
      );
    }

    return new Prisma.Decimal(targetRate).div(baseRate);
  }

  private readCurrencyList(key: string, fallback: string[]): string[] {
    const value = this.configService.get<string>(key);
    if (!value) {
      return fallback;
    }

    return value
      .split(',')
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
  }

  private normalizeDate(value: Date): Date {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }

  private buildCacheKey(
    tenantId: string,
    baseCurrency: string,
    targetCurrency: string,
    effectiveDate: Date,
  ) {
    return `finance:fx:${tenantId}:${baseCurrency}:${targetCurrency}:${effectiveDate.toISOString().slice(0, 10)}`;
  }

  private async getCachedRate(cacheKey: string) {
    try {
      const redis = await this.ensureRedisConnection();
      if (!redis) {
        return null;
      }
      const value = await redis.get(cacheKey);
      return value ? new Prisma.Decimal(value) : null;
    } catch {
      return null;
    }
  }

  private async setCachedRate(cacheKey: string, rate: Prisma.Decimal) {
    try {
      const redis = await this.ensureRedisConnection();
      if (!redis) {
        return;
      }
      await redis.set(cacheKey, rate.toString(), 'EX', 60 * 60 * 24);
    } catch {
      // Cache is best-effort only.
    }
  }

  private async ensureRedisConnection() {
    if (this.redisDisabled) {
      return null;
    }

    const redis = this.getRedisClient();
    if (redis.status === 'ready') {
      return redis;
    }

    if (redis.status === 'wait') {
      try {
        await redis.connect();
        return redis;
      } catch {
        this.redisDisabled = true;
        redis.disconnect();
        return null;
      }
    }

    return redis.status === 'ready' ? redis : null;
  }

  async onModuleDestroy() {
    await this.shutdownRedis();
  }

  async onApplicationShutdown() {
    await this.shutdownRedis();
  }

  private async shutdownRedis() {
    if (!this.redis || this.redis.status === 'end') {
      return;
    }

    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }

  private getRedisClient() {
    if (this.redis) {
      return this.redis;
    }

    const redisUrl = this.configService.get<string>('REDIS_URL');
    this.redis = redisUrl
      ? new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          retryStrategy: () => null,
        })
      : new Redis({
          host: this.configService.get<string>('REDIS_HOST', 'localhost'),
          port: this.configService.get<number>('REDIS_PORT', 6379),
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          retryStrategy: () => null,
        });

    this.redis.on('error', () => {
      this.redisDisabled = true;
    });

    return this.redis;
  }
}
