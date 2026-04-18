import { IsOptional, IsString } from "class-validator";

export class PayrollQueryDto {
  @IsOptional()
  @IsString()
  legalEntityId?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  period?: string;
}
