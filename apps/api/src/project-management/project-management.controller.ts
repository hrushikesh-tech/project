import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Roles } from "../common/decorators/roles.decorator";
import { ProjectManagementService } from "./project-management.service";
import { CreateProjectDto } from "./dto/create-project.dto";
import { UpdateProjectDto } from "./dto/update-project.dto";
import { ProjectQueryDto } from "./dto/project-query.dto";
import { CreateTaskDto } from "./dto/create-task.dto";
import { UpdateTaskDto } from "./dto/update-task.dto";
import { TaskQueryDto } from "./dto/task-query.dto";
import { CreateMilestoneDto } from "./dto/create-milestone.dto";
import { UpdateMilestoneDto } from "./dto/update-milestone.dto";
import { MilestoneQueryDto } from "./dto/milestone-query.dto";
import { CreateTaskDependencyDto } from "./dto/create-task-dependency.dto";
import { ProjectUtilizationQueryDto } from "./dto/project-utilization-query.dto";
import { EntityIdPipe } from "../common/validation/entity-id.pipe";

@ApiTags("project-management")
@Controller({ path: "projects", version: "1" })
export class ProjectManagementController {
  constructor(
    private readonly projectManagementService: ProjectManagementService,
  ) {}

  @Post()
  @Roles("project_manager", "tenant_admin")
  createProject(@Body() dto: CreateProjectDto) {
    return this.projectManagementService.createProject(dto);
  }

  @Get()
  @Roles("project_manager", "tenant_admin", "viewer")
  listProjects(@Query() query: ProjectQueryDto) {
    return this.projectManagementService.listProjects(query);
  }

  @Get("utilization")
  @Roles("project_manager", "tenant_admin", "viewer")
  getUtilization(@Query() query: ProjectUtilizationQueryDto) {
    return this.projectManagementService.getUtilization(query);
  }

  @Get(":id")
  @Roles("project_manager", "tenant_admin", "viewer")
  getProject(@Param("id", EntityIdPipe) id: string) {
    return this.projectManagementService.getProject(id);
  }

  @Patch(":id")
  @Roles("project_manager", "tenant_admin")
  updateProject(@Param("id", EntityIdPipe) id: string, @Body() dto: UpdateProjectDto) {
    return this.projectManagementService.updateProject(id, dto);
  }

  @Post("tasks")
  @Roles("project_manager", "tenant_admin")
  createTask(@Body() dto: CreateTaskDto) {
    return this.projectManagementService.createTask(dto);
  }

  @Get("tasks")
  @Roles("project_manager", "tenant_admin", "viewer")
  listTasks(@Query() query: TaskQueryDto) {
    return this.projectManagementService.listTasks(query);
  }

  @Get("tasks/:id")
  @Roles("project_manager", "tenant_admin", "viewer")
  getTask(@Param("id", EntityIdPipe) id: string) {
    return this.projectManagementService.getTask(id);
  }

  @Patch("tasks/:id")
  @Roles("project_manager", "tenant_admin")
  updateTask(@Param("id", EntityIdPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.projectManagementService.updateTask(id, dto);
  }

  @Post("milestones")
  @Roles("project_manager", "tenant_admin")
  createMilestone(@Body() dto: CreateMilestoneDto) {
    return this.projectManagementService.createMilestone(dto);
  }

  @Get("milestones")
  @Roles("project_manager", "tenant_admin", "viewer")
  listMilestones(@Query() query: MilestoneQueryDto) {
    return this.projectManagementService.listMilestones(query);
  }

  @Get("milestones/:id")
  @Roles("project_manager", "tenant_admin", "viewer")
  getMilestone(@Param("id", EntityIdPipe) id: string) {
    return this.projectManagementService.getMilestone(id);
  }

  @Patch("milestones/:id")
  @Roles("project_manager", "tenant_admin")
  updateMilestone(@Param("id", EntityIdPipe) id: string, @Body() dto: UpdateMilestoneDto) {
    return this.projectManagementService.updateMilestone(id, dto);
  }

  @Post("dependencies")
  @Roles("project_manager", "tenant_admin")
  createTaskDependency(@Body() dto: CreateTaskDependencyDto) {
    return this.projectManagementService.createTaskDependency(dto);
  }

  @Get("dependencies")
  @Roles("project_manager", "tenant_admin", "viewer")
  listTaskDependencies(@Query("taskId") taskId?: string) {
    return this.projectManagementService.listTaskDependencies(taskId);
  }

  @Delete("dependencies/:id")
  @Roles("project_manager", "tenant_admin")
  deleteTaskDependency(@Param("id", EntityIdPipe) id: string) {
    return this.projectManagementService.deleteTaskDependency(id);
  }
}
