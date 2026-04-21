import { IsDateString, IsOptional, IsString } from "class-validator";

export class ProjectUtilizationQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;
}
