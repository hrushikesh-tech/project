import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

export class CreateVendorDto {
  @IsString()
  legalEntityId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(40)
  code!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  payablesAccountId?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  paymentTerms?: number;
}
