import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
} from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { ForecastingService } from "./forecasting.service";

type RequestUser = { tenantId?: string; roles?: string[] };

@Controller("api/v1/forecasting")
export class ForecastingController {
  constructor(private readonly forecastingService: ForecastingService) {}

  @Get("health")
  @Roles("tenant_admin", "viewer")
  getHealth() {
    return this.forecastingService.health();
  }

  @Get("models")
  @Roles("tenant_admin", "viewer")
  listModels() {
    return this.forecastingService.listModels();
  }

  @Get("models/:id")
  @Roles("tenant_admin", "viewer")
  getModel(@Param("id") id: string) {
    return this.forecastingService.getModelDetails(id);
  }

  @Post("products/:productId/predict")
  @Roles("tenant_admin", "viewer")
  predictForProduct(
    @Param("productId") productId: string,
    @Headers("x-tenant-id") tenantHeader: string | undefined,
    @Req() request: { user?: RequestUser },
  ) {
    const tenantId = request.user?.tenantId ?? tenantHeader;
    return this.forecastingService.predictForProduct(
      this.requireTenantId(tenantId),
      productId,
    );
  }

  @Post("retrain")
  @Roles("tenant_admin")
  retrainTenantForecasts(
    @Headers("x-tenant-id") tenantHeader: string | undefined,
    @Req() request: { user?: RequestUser },
  ) {
    const tenantId = request.user?.tenantId ?? tenantHeader;
    return this.forecastingService.runWeeklyRetrainingForTenant(
      this.requireTenantId(tenantId),
    );
  }

  private requireTenantId(tenantId: string | undefined) {
    if (!tenantId) {
      throw new BadRequestException(
        "Tenant context required for forecasting operations.",
      );
    }
    return tenantId;
  }
}
