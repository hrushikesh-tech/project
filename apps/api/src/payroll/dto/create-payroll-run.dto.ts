import { Type } from "class-transformer";
import { IsBoolean, IsDateString, IsOptional, IsString } from "class-validator";

export class CreatePayrollRunDto {
  @IsString()
  legalEntityId!: string;

  @IsOptional()
  @IsString()
  period?: string;

  @IsDateString()
  periodStart!: string;

  @IsDateString()
  periodEnd!: string;

  @IsOptional()
  @IsString()
  fiscalPeriodId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enqueueImmediately?: boolean;
}
