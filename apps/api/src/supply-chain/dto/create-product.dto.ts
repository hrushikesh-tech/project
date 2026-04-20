import { Type } from "class-transformer";
import {
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

export class CreateProductDto {
  @IsString()
  @MaxLength(60)
  sku!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2,10}$/)
  unitOfMeasure?: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  reorderPoint!: number;
}
