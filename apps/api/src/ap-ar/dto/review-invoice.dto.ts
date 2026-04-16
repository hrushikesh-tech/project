import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

const normalizeUppercase = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

const normalizeString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ReviewInvoiceDto {
  @IsString()
  @IsIn(['APPROVE', 'REJECT', 'RETRY_MATCH'])
  @Transform(normalizeUppercase)
  action!: string;

  @IsOptional()
  @IsString()
  @Length(1, 500)
  @Transform(normalizeString)
  reason?: string;
}
