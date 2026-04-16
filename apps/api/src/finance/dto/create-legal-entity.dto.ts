import { IsBoolean, IsOptional, IsString, Length, Matches } from 'class-validator';

export class CreateLegalEntityDto {
  @IsString()
  @Length(2, 20)
  code!: string;

  @IsString()
  @Length(2, 120)
  name!: string;

  @IsString()
  @Matches(/^[A-Z]{3}$/)
  baseCurrency!: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
