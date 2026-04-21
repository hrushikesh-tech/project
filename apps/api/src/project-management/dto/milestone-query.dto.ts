import { IsOptional, IsString } from "class-validator";

export class MilestoneQueryDto {
  @IsOptional()
  @IsString()
  projectId?: string;
}
