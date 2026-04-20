import { IsOptional, IsString } from "class-validator";

export class PurchaseOrderQueryDto {
  @IsOptional()
  @IsString()
  vendorId?: string;

  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
