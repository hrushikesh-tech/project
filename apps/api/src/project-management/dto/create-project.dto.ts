import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";
import { ProjectStatus } from "@amdox/types";

export class CreateProjectDto {
  @IsString()
  @MaxLength(40)
  code!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsString()
  managerId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  budget!: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualCost?: number;

  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
