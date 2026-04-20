import { Type } from "class-transformer";
import { IsOptional, IsString, Min } from "class-validator";

export class ConsumeInventoryDto {
  @IsString()
  productId!: string;

  @IsString()
  warehouseId!: string;

  @Type(() => Number)
  @Min(0.0001)
  quantity!: number;

  @IsOptional()
  @IsString()
  referenceType?: string;

  @IsOptional()
  @IsString()
  referenceId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  performedBy?: string;
}
