import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Sse,
} from "@nestjs/common";
import { Roles } from "../common/decorators/roles.decorator";
import { RequestUser } from "../common/interfaces/request-user.interface";
import { BiService } from "./bi.service";
import { BiReportService } from "./reports/bi-report.service";
import { CreateDashboardDto } from "./dto/create-dashboard.dto";
import { UpdateDashboardDto } from "./dto/update-dashboard.dto";
import { CreateWidgetDto } from "./dto/create-widget.dto";
import { UpdateWidgetDto } from "./dto/update-widget.dto";
import { MetricQueryDto } from "./dto/metric-query.dto";
import { CreateReportScheduleDto } from "./dto/create-report-schedule.dto";
import { UpdateReportScheduleDto } from "./dto/update-report-schedule.dto";

@Controller("api/v1/bi")
export class BiController {
  constructor(
    private readonly biService: BiService,
    private readonly biReportService: BiReportService,
  ) {}

  @Get("dashboards")
  @Roles(
    "tenant_admin",
    "viewer",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  listDashboards(@Req() request: { user?: RequestUser }) {
    return this.biService.listDashboards(request.user ?? {});
  }

  @Post("dashboards")
  @Roles(
    "tenant_admin",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  createDashboard(
    @Body() dto: CreateDashboardDto,
    @Req() request: { user?: RequestUser },
  ) {
    return this.biService.createDashboard(dto, request.user ?? {});
  }

  @Get("dashboards/:id")
  @Roles(
    "tenant_admin",
    "viewer",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  getDashboard(
    @Param("id") id: string,
    @Req() request: { user?: RequestUser },
  ) {
    return this.biService.getDashboard(id, request.user ?? {});
  }

  @Patch("dashboards/:id")
  @Roles(
    "tenant_admin",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  updateDashboard(
    @Param("id") id: string,
    @Body() dto: UpdateDashboardDto,
    @Req() request: { user?: RequestUser },
  ) {
    return this.biService.updateDashboard(id, dto, request.user ?? {});
  }

  @Delete("dashboards/:id")
  @Roles(
    "tenant_admin",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  deleteDashboard(
    @Param("id") id: string,
    @Req() request: { user?: RequestUser },
  ) {
    return this.biService.deleteDashboard(id, request.user ?? {});
  }

  @Post("dashboards/:id/widgets")
  @Roles(
    "tenant_admin",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  addWidget(
    @Param("id") dashboardId: string,
    @Body() dto: CreateWidgetDto,
    @Req() request: { user?: RequestUser },
  ) {
    return this.biService.addWidget(dashboardId, dto, request.user ?? {});
  }

  @Patch("dashboards/:dashboardId/widgets/:widgetId")
  @Roles(
    "tenant_admin",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  updateWidget(
    @Param("dashboardId") dashboardId: string,
    @Param("widgetId") widgetId: string,
    @Body() dto: UpdateWidgetDto,
    @Req() request: { user?: RequestUser },
  ) {
    return this.biService.updateWidget(
      dashboardId,
      widgetId,
      dto,
      request.user ?? {},
    );
  }

  @Delete("dashboards/:dashboardId/widgets/:widgetId")
  @Roles(
    "tenant_admin",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  deleteWidget(
    @Param("dashboardId") dashboardId: string,
    @Param("widgetId") widgetId: string,
    @Req() request: { user?: RequestUser },
  ) {
    return this.biService.deleteWidget(
      dashboardId,
      widgetId,
      request.user ?? {},
    );
  }

  @Get("dashboards/:id/data")
  @Roles(
    "tenant_admin",
    "viewer",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  getDashboardData(
    @Param("id") id: string,
    @Query() query: MetricQueryDto,
    @Req() request: { user?: RequestUser },
  ) {
    return this.biService.getDashboardData(id, request.user ?? {}, query);
  }

  @Sse("dashboards/:id/stream")
  @Roles(
    "tenant_admin",
    "viewer",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  streamDashboard(
    @Param("id") id: string,
    @Req() request: { user?: RequestUser },
  ) {
    return this.biService.streamDashboard(id, request.user ?? {});
  }

  @Get("report-schedules")
  @Roles(
    "tenant_admin",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  listReportSchedules(@Req() request: { user?: RequestUser }) {
    return this.biReportService.listSchedules(request.user ?? {});
  }

  @Post("report-schedules")
  @Roles(
    "tenant_admin",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  createReportSchedule(
    @Body() dto: CreateReportScheduleDto,
    @Req() request: { user?: RequestUser },
  ) {
    return this.biReportService.createSchedule(dto, request.user ?? {});
  }

  @Patch("report-schedules/:id")
  @Roles(
    "tenant_admin",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
  )
  updateReportSchedule(
    @Param("id") id: string,
    @Body() dto: UpdateReportScheduleDto,
    @Req() request: { user?: RequestUser },
  ) {
    return this.biReportService.updateSchedule(id, dto, request.user ?? {});
  }
}
