import { IsDateString, IsString, Length } from 'class-validator';

export class CreateFiscalPeriodDto {
  @IsString()
  legalEntityId!: string;

  @IsString()
  @Length(2, 80)
  name!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}
