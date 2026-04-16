import { JournalEntryStatus } from '@amdox/types';
import { IsDateString, IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class LegalEntityScopeQueryDto {
  @IsString()
  legalEntityId!: string;
}

export class JournalEntryQueryDto extends LegalEntityScopeQueryDto {
  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsEnum(JournalEntryStatus)
  status?: JournalEntryStatus;
}

export class FxRateQueryDto {
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  baseCurrency!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  targetCurrency!: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;
}

export class ReportQueryDto extends LegalEntityScopeQueryDto {
  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
