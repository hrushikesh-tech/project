import { Transform } from 'class-transformer';
import { IsDateString, IsIn, IsOptional, IsString, Length } from 'class-validator';

const normalizeUppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const normalizeString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AgingReportQueryDto {
  @IsString()
  @Length(1, 64)
  @Transform(normalizeString)
  legalEntityId!: string;

  @IsString()
  @IsIn(['PAYABLE', 'RECEIVABLE'])
  @Transform(normalizeUppercase)
  type!: string;

  @IsDateString()
  asOfDate!: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Transform(normalizeString)
  vendorId?: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Transform(normalizeString)
  customerId?: string;
}
