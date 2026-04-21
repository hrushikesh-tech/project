import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class UpdateMilestoneDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;
}
