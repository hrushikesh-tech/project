import {
  Args,
  Context,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from "@nestjs/graphql";
import { Roles } from "../../../common/decorators/roles.decorator";
import { BiService } from "../../bi.service";
import { BiWidgetLoader } from "../loaders/bi-widget.loader";

type GraphqlRequest = {
  user?: {
    userId?: string;
    roles?: string[];
    tenantId?: string;
  };
};

@Resolver("BiDashboard")
export class BiDashboardResolver {
  constructor(
    private readonly biService: BiService,
    private readonly widgetLoader: BiWidgetLoader,
  ) {}

  @Query("biDashboards")
  @Roles(
    "tenant_admin",
    "viewer",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  biDashboards(@Context("req") request: GraphqlRequest) {
    return this.biService.listDashboards(request.user ?? {});
  }

  @Query("biDashboard")
  @Roles(
    "tenant_admin",
    "viewer",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  biDashboard(
    @Args("id") id: string,
    @Context("req") request: GraphqlRequest,
  ) {
    return this.biService.getDashboard(id, request.user ?? {});
  }

  @Query("biDashboardData")
  @Roles(
    "tenant_admin",
    "viewer",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  biDashboardData(
    @Args("id") id: string,
    @Args("filters", { nullable: true }) filters: Record<string, unknown> | null,
    @Context("req") request: GraphqlRequest,
  ) {
    return this.biService.getDashboardData(
      id,
      request.user ?? {},
      (filters ?? {}) as never,
    );
  }

  @ResolveField("widgets")
  widgets(@Parent() dashboard: { id: string }) {
    return this.widgetLoader.byDashboardId.load(dashboard.id);
  }
}
