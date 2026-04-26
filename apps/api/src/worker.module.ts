import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ScheduleModule } from "@nestjs/schedule";
import { ClsModule } from "nestjs-cls";
import { PrismaModule } from "./prisma/prisma.module";
import { FinanceModule } from "./finance/finance.module";
import { ApArModule } from "./ap-ar/ap-ar.module";
import { HrModule } from "./hr/hr.module";
import { PayrollModule } from "./payroll/payroll.module";
import { SupplyChainModule } from "./supply-chain/supply-chain.module";
import { ForecastingModule } from "./forecasting/forecasting.module";
import { BiModule } from "./bi/bi.module";
import { ProjectManagementModule } from "./project-management/project-management.module";
import { NotificationsModule } from "./notifications/notifications.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    PrismaModule,
    FinanceModule,
    ApArModule,
    HrModule,
    PayrollModule,
    SupplyChainModule,
    ForecastingModule,
    BiModule,
    ProjectManagementModule,
    NotificationsModule,
  ],
})
export class WorkerAppModule {}

