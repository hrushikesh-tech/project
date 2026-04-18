import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
} from "class-validator";

const toBoolean = ({ value }: { value: unknown }) =>
  value === true || value === "true" || value === "1";

const toNumber = ({ value }: { value: unknown }) =>
  value == null || value === "" ? undefined : Number(value);

export class HrQueryDto {
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  activeRoster?: boolean;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;

  @IsOptional()
  @IsString()
  rootEmployeeId?: string;

  @IsOptional()
  @IsString()
  employeeId?: string;

  @IsOptional()
  @Transform(toNumber)
  @IsInt()
  year?: number;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
