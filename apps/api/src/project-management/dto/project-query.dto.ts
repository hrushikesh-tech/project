import { IsEnum, IsOptional, IsString } from "class-validator";
import { ProjectStatus } from "@amdox/types";

export class ProjectQueryDto {
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsString()
  managerId?: string;
}
