import { IsDateString, IsOptional, IsString } from "class-validator";

export class AttendanceActionDto {
  @IsString()
  employeeId!: string;

  @IsOptional()
  @IsDateString()
  timestamp?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
