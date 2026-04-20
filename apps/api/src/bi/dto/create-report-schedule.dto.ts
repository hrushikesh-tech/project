import { BI_REPORT_FORMATS } from "@amdox/types";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";

export class CreateReportScheduleDto {
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsString()
  dashboardId!: string;

  @IsString()
  cronExpression!: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  recipients!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @IsIn(BI_REPORT_FORMATS, { each: true })
  formats!: ("PDF" | "EXCEL")[];

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
