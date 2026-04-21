import { IsDateString, IsString, MaxLength } from "class-validator";

export class CreateMilestoneDto {
  @IsString()
  projectId!: string;

  @IsString()
  @MaxLength(120)
  name!: string;

  @IsDateString()
  dueDate!: string;
}
