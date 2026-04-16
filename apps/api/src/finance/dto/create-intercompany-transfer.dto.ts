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

export class CreateIntercompanyTransferLineDto {
  @IsString()
  sourceAccountId!: string;

  @IsString()
  destinationAccountId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountMinor!: number;

  @IsOptional()
  @IsString()
  description?: string;
}

export class CreateIntercompanyTransferDto {
  @IsString()
  sourceLegalEntityId!: string;

  @IsString()
  destinationLegalEntityId!: string;

  @IsString()
  sourcePeriodId!: string;

  @IsString()
  destinationPeriodId!: string;

  @IsString()
  sourceClearingAccountId!: string;

  @IsString()
  destinationClearingAccountId!: string;

  @IsDateString()
  transactionDate!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency!: string;

  @IsString()
  description!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateIntercompanyTransferLineDto)
  lines!: CreateIntercompanyTransferLineDto[];
}
