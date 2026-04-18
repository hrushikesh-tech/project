import { IsDateString, IsOptional, IsString } from "class-validator";

export class CorrectAttendanceDto {
  @IsOptional()
  @IsDateString()
  clockIn?: string;

  @IsOptional()
  @IsDateString()
  clockOut?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsString()
  correctionReason!: string;
}
