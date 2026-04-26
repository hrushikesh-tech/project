import { Args, Context, Query, Resolver } from "@nestjs/graphql";
import { Roles } from "../../../common/decorators/roles.decorator";
import { BiMetricsService } from "../../metrics/bi-metrics.service";
import { ClsService } from "nestjs-cls";

type GraphqlRequest = {
  user?: { tenantId?: string };
};

@Resolver("Query")
export class BiMetricResolver {
  constructor(
    private readonly metricsService: BiMetricsService,
    private readonly cls: ClsService,
  ) {}

  @Query("biMetric")
  @Roles(
    "tenant_admin",
    "viewer",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  async biMetric(
    @Args("metricKey") metricKey: string,
    @Args("filters", { nullable: true }) filters: Record<string, unknown> | null,
    @Context("req") request?: GraphqlRequest,
  ) {
    const tenantId =
      this.cls.get<string>("tenantId") ?? request?.user?.tenantId;
    if (!tenantId) {
      throw new Error("Tenant context required.");
    }

    return this.metricsService.getMetric(
      tenantId,
      metricKey,
      (filters ?? {}) as never,
    );
  }
}
