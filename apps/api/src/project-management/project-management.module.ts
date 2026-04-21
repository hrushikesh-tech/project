import { Module } from "@nestjs/common";
import { APP_FILTER } from "@nestjs/core";
import { ProjectManagementController } from "./project-management.controller";
import { ProjectManagementService } from "./project-management.service";
import { ProjectDependencyService } from "./project-dependency.service";
import { ProjectBudgetAlertService } from "./project-budget-alert.service";
import { ProjectManagementExceptionFilter } from "./project-management-exception.filter";

@Module({
  controllers: [ProjectManagementController],
  providers: [
    ProjectManagementService,
    ProjectDependencyService,
    ProjectBudgetAlertService,
    {
      provide: APP_FILTER,
      useClass: ProjectManagementExceptionFilter,
    },
  ],
  exports: [ProjectManagementService],
})
export class ProjectManagementModule {}
