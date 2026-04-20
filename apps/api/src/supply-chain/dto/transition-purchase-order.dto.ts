import { IsOptional, IsString } from "class-validator";

export class TransitionPurchaseOrderDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
