import { Body, Controller, Get, Param, Post, Put, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Roles } from "../common/decorators/roles.decorator";
import { CreatePayrollRunDto } from "./dto/create-payroll-run.dto";
import { PayrollQueryDto } from "./dto/payroll-query.dto";
import { UpsertSalaryStructureDto } from "./dto/upsert-salary-structure.dto";
import { PayrollService } from "./payroll.service";
import { RateLimit } from "../common/security/rate-limit.decorator";
import { RATE_LIMIT_BUCKETS } from "../common/security/rate-limit.policy";
import { EntityIdPipe } from "../common/validation/entity-id.pipe";

@ApiTags("payroll")
@Controller({ path: "payroll", version: "1" })
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Put("salary-structures/:employeeId")
  @Roles("hr_manager", "tenant_admin")
  upsertSalaryStructure(
    @Param("employeeId", EntityIdPipe) employeeId: string,
    @Body() dto: UpsertSalaryStructureDto,
  ) {
    return this.payrollService.upsertSalaryStructure(employeeId, dto);
  }

  @Get("salary-structures/:employeeId")
  @Roles("hr_manager", "tenant_admin", "finance_manager")
  getSalaryStructure(@Param("employeeId", EntityIdPipe) employeeId: string) {
    return this.payrollService.getSalaryStructure(employeeId);
  }

  @Post("runs")
  @RateLimit(RATE_LIMIT_BUCKETS.PAYROLL)
  @Roles("hr_manager", "tenant_admin")
  createPayrollRun(@Body() dto: CreatePayrollRunDto) {
    return this.payrollService.createPayrollRun(dto);
  }

  @Get("runs")
  @Roles("hr_manager", "tenant_admin", "finance_manager")
  listPayrollRuns(@Query() query: PayrollQueryDto) {
    return this.payrollService.listPayrollRuns(query);
  }

  @Get("runs/:id")
  @Roles("hr_manager", "tenant_admin", "finance_manager")
  getPayrollRun(@Param("id", EntityIdPipe) id: string) {
    return this.payrollService.getPayrollRun(id);
  }

  @Get("runs/:id/results")
  @Roles("hr_manager", "tenant_admin", "finance_manager")
  listPayrollResults(@Param("id", EntityIdPipe) id: string) {
    return this.payrollService.listPayrollResults(id);
  }
}
