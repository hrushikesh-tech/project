import { IsOptional, IsString, MaxLength } from "class-validator";

export class CreateWarehouseDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  @MaxLength(40)
  code!: string;

  @IsOptional()
  @IsString()
  address?: string;
}
