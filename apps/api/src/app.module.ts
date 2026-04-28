import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule } from "@nestjs/config";
import { ClsModule } from "nestjs-cls";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { HealthModule } from "./health/health.module";
import { FinanceModule } from "./finance/finance.module";
import { ApArModule } from "./ap-ar/ap-ar.module";
import { HrModule } from "./hr/hr.module";
import { PayrollModule } from "./payroll/payroll.module";
import { SupplyChainModule } from "./supply-chain/supply-chain.module";
import { ForecastingModule } from "./forecasting/forecasting.module";
import { BiModule } from "./bi/bi.module";
import { GdprModule } from "./gdpr/gdpr.module";
import { ProjectManagementModule } from "./project-management/project-management.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { BiGraphqlModule } from "./bi/graphql/bi-graphql.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { TenantGuard } from "./common/guards/tenant.guard";
import { AuditInterceptor } from "./common/interceptors/audit.interceptor";
import { ApiSuccessInterceptor } from "./common/api/api-success.interceptor";
import { ApiExceptionFilter } from "./common/api/api-exception.filter";
import { RateLimitGuard } from "./common/security/rate-limit.guard";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
    FinanceModule,
    ApArModule,
    HrModule,
    PayrollModule,
    SupplyChainModule,
    ForecastingModule,
    BiModule,
    GdprModule,
    BiGraphqlModule,
    ProjectManagementModule,
    NotificationsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: TenantGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_INTERCEPTOR, useClass: ApiSuccessInterceptor },
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
})
export class AppModule {}
