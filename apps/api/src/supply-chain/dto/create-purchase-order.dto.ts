import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";

class CreatePurchaseOrderLineDto {
  @IsString()
  productId!: string;

  @IsString()
  @MaxLength(240)
  description!: string;

  @Type(() => Number)
  @Min(0.0001)
  quantity!: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  unitPrice!: number;
}

export class CreatePurchaseOrderDto {
  @IsString()
  vendorId!: string;

  @IsString()
  legalEntityId!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsOptional()
  @IsDateString()
  expectedDelivery?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderLineDto)
  lines!: CreatePurchaseOrderLineDto[];
}

export { CreatePurchaseOrderLineDto };
