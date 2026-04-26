import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Roles } from "../common/decorators/roles.decorator";
import { HrService } from "./hr.service";
import { CreateDepartmentDto } from "./dto/create-department.dto";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { CreateLeaveRequestDto } from "./dto/create-leave-request.dto";
import { AttendanceActionDto } from "./dto/attendance-action.dto";
import { CorrectAttendanceDto } from "./dto/correct-attendance.dto";
import { HrQueryDto } from "./dto/hr-query.dto";
import { ReviewLeaveRequestDto } from "./dto/review-leave-request.dto";
import { UpdateDepartmentDto } from "./dto/update-department.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { EntityIdPipe } from "../common/validation/entity-id.pipe";

@ApiTags("hr")
@Controller({ path: "hr", version: "1" })
export class HrController {
  constructor(private readonly hrService: HrService) {}

  @Post("employees")
  @Roles("hr_manager", "tenant_admin")
  createEmployee(@Body() dto: CreateEmployeeDto) {
    return this.hrService.createEmployee(dto);
  }

  @Get("employees")
  @Roles("hr_manager", "tenant_admin", "viewer")
  listEmployees(@Query() query: HrQueryDto) {
    return this.hrService.listEmployees(query);
  }

  @Get("employees/:id")
  @Roles("hr_manager", "tenant_admin", "viewer")
  getEmployee(@Param("id", EntityIdPipe) id: string) {
    return this.hrService.getEmployee(id);
  }

  @Patch("employees/:id")
  @Roles("hr_manager", "tenant_admin")
  updateEmployee(@Param("id", EntityIdPipe) id: string, @Body() dto: UpdateEmployeeDto) {
    return this.hrService.updateEmployee(id, dto);
  }

  @Post("departments")
  @Roles("hr_manager", "tenant_admin")
  createDepartment(@Body() dto: CreateDepartmentDto) {
    return this.hrService.createDepartment(dto);
  }

  @Get("departments/tree")
  @Roles("hr_manager", "tenant_admin", "viewer")
  getDepartmentTree(@Query() query: HrQueryDto) {
    return this.hrService.getDepartmentTree(query.departmentId);
  }

  @Get("departments")
  @Roles("hr_manager", "tenant_admin", "viewer")
  listDepartments() {
    return this.hrService.listDepartments();
  }

  @Get("departments/:id")
  @Roles("hr_manager", "tenant_admin", "viewer")
  getDepartment(@Param("id", EntityIdPipe) id: string) {
    return this.hrService.getDepartment(id);
  }

  @Patch("departments/:id")
  @Roles("hr_manager", "tenant_admin")
  updateDepartment(@Param("id", EntityIdPipe) id: string, @Body() dto: UpdateDepartmentDto) {
    return this.hrService.updateDepartment(id, dto);
  }

  @Get("org-chart")
  @Roles("hr_manager", "tenant_admin", "viewer")
  getOrgChart(@Query() query: HrQueryDto) {
    return this.hrService.getOrgChart(query.rootEmployeeId);
  }

  @Post("leave-requests")
  createLeaveRequest(@Body() dto: CreateLeaveRequestDto) {
    return this.hrService.createLeaveRequest(dto);
  }

  @Post("leave-requests/:id/submit")
  submitLeaveRequest(@Param("id", EntityIdPipe) id: string) {
    return this.hrService.submitLeaveRequest(id);
  }

  @Post("leave-requests/:id/approve")
  approveLeaveRequest(
    @Param("id", EntityIdPipe) id: string,
    @Req() request: { user?: { userId: string; roles?: string[] } },
  ) {
    return this.hrService.approveLeaveRequest(id, request.user);
  }

  @Post("leave-requests/:id/reject")
  rejectLeaveRequest(
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @Req() request: { user?: { userId: string; roles?: string[] } },
  ) {
    return this.hrService.rejectLeaveRequest(id, dto, request.user);
  }

  @Post("leave-requests/:id/cancel")
  cancelLeaveRequest(
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: ReviewLeaveRequestDto,
    @Req() request: { user?: { userId: string; roles?: string[] } },
  ) {
    return this.hrService.cancelLeaveRequest(id, dto, request.user);
  }

  @Get("leave-balances")
  @Roles("hr_manager", "tenant_admin", "viewer")
  listLeaveBalances(@Query() query: HrQueryDto) {
    return this.hrService.listLeaveBalances(query);
  }

  @Post("attendance/clock-in")
  @Roles("hr_manager", "tenant_admin", "viewer")
  clockIn(@Body() dto: AttendanceActionDto) {
    return this.hrService.clockIn(dto);
  }

  @Post("attendance/clock-out")
  @Roles("hr_manager", "tenant_admin", "viewer")
  clockOut(@Body() dto: AttendanceActionDto) {
    return this.hrService.clockOut(dto);
  }

  @Patch("attendance/:id/correct")
  @Roles("hr_manager", "tenant_admin", "viewer")
  correctAttendance(
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: CorrectAttendanceDto,
    @Req() request: { user?: { userId: string; roles?: string[] } },
  ) {
    return this.hrService.correctAttendance(id, dto, request.user);
  }

  @Get("attendance")
  @Roles("hr_manager", "tenant_admin", "viewer")
  listAttendance(@Query() query: HrQueryDto) {
    return this.hrService.listAttendance(query);
  }
}
