import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from "class-validator";

class CreateGoodsReceiptLineDto {
  @IsString()
  purchaseOrderLineId!: string;

  @Type(() => Number)
  @Min(0.0001)
  quantityReceived!: number;
}

export class CreateGoodsReceiptDto {
  @IsString()
  purchaseOrderId!: string;

  @IsString()
  warehouseId!: string;

  @IsOptional()
  @IsString()
  receivedBy?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateGoodsReceiptLineDto)
  lines!: CreateGoodsReceiptLineDto[];
}

export { CreateGoodsReceiptLineDto };
