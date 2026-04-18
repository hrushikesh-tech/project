import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from "class-validator";

class SalaryComponentDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsIn(["EARNING", "DEDUCTION"])
  componentType!: "EARNING" | "DEDUCTION";

  @Type(() => Number)
  @IsInt()
  @Min(0)
  amountMinor!: number;

  @IsOptional()
  @IsString()
  calculationType?: string;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @IsOptional()
  @IsBoolean()
  isTaxable?: boolean;

  @IsOptional()
  @IsBoolean()
  pfApplicable?: boolean;

  @IsOptional()
  @IsBoolean()
  professionalTaxApplicable?: boolean;

  @IsOptional()
  @IsBoolean()
  overtimeApplicable?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpsertSalaryStructureDto {
  @IsString()
  legalEntityId!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsIn(["OLD", "NEW"])
  taxRegime!: "OLD" | "NEW";

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsOptional()
  @IsBoolean()
  pfApplicable?: boolean;

  @IsOptional()
  @IsBoolean()
  professionalTaxApplicable?: boolean;

  @IsOptional()
  @IsBoolean()
  overtimeEligible?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SalaryComponentDto)
  components!: SalaryComponentDto[];
}
