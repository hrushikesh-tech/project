import { IsDateString, IsEmail, IsOptional, IsString } from "class-validator";

export class CreateEmployeeDto {
  @IsString()
  employeeCode!: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsDateString()
  hireDate!: string;

  @IsOptional()
  @IsDateString()
  terminationDate?: string;

  @IsString()
  departmentId!: string;

  @IsOptional()
  @IsString()
  designationId?: string;

  @IsOptional()
  @IsString()
  managerId?: string;
}
