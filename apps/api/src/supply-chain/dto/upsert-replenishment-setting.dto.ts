import { Type } from "class-transformer";
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";

export class UpsertReplenishmentSettingDto {
  @IsString()
  legalEntityId!: string;

  @IsString()
  vendorId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.0001)
  reorderQuantity!: number;

  @IsOptional()
  @IsBoolean()
  isAutoReorderEnabled?: boolean;
}
