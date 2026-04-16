import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateJournalLineDto {
  @IsString()
  accountId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  debitAmountMinor?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  creditAmountMinor?: number;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateJournalEntryDto {
  @IsString()
  legalEntityId!: string;

  @IsString()
  periodId!: string;

  @IsDateString()
  date!: string;

  @IsString()
  description!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => CreateJournalLineDto)
  lines!: CreateJournalLineDto[];
}

export class ReverseJournalEntryDto {
  @IsOptional()
  @IsDateString()
  reversalDate?: string;

  @IsOptional()
  @IsString()
  periodId?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
