import { WidgetType } from "@amdox/db";
import { BI_METRIC_KEYS } from "@amdox/types";
import {
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from "class-validator";

export class CreateWidgetDto {
  @IsEnum(WidgetType)
  type!: WidgetType;

  @IsString()
  @MaxLength(120)
  title!: string;

  @IsIn(BI_METRIC_KEYS)
  metricKey!: string;

  @IsObject()
  position!: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  refreshEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
