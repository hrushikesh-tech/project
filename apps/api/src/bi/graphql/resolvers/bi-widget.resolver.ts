import { Args, Context, Parent, ResolveField, Resolver } from "@nestjs/graphql";
import { ClsService } from "nestjs-cls";
import { BiMetricsService } from "../../metrics/bi-metrics.service";

type GraphqlRequest = {
  user?: {
    tenantId?: string;
  };
};

type GraphqlWidget = {
  metricKey: string;
  config?: {
    filters?: Record<string, unknown>;
  };
};

@Resolver("BiWidget")
export class BiWidgetResolver {
  constructor(
    private readonly metricsService: BiMetricsService,
    private readonly cls: ClsService,
  ) {}

  @ResolveField("metric")
  async metric(
    @Parent() widget: GraphqlWidget,
    @Args("filters", { nullable: true }) filters: Record<string, unknown> | null,
    @Context("req") request?: GraphqlRequest,
  ) {
    const tenantId =
      this.cls.get<string>("tenantId") ?? request?.user?.tenantId;
    if (!tenantId) {
      throw new Error("Tenant context required.");
    }

    const widgetFilters =
      widget.config &&
      typeof widget.config === "object" &&
      widget.config.filters &&
      typeof widget.config.filters === "object"
        ? widget.config.filters
        : {};

    return this.metricsService.getMetric(tenantId, widget.metricKey, {
      ...widgetFilters,
      ...(filters ?? {}),
    } as never);
  }
}
