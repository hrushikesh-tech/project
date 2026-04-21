import { IsEnum, IsString } from "class-validator";
import { DependencyType } from "@amdox/types";

export class CreateTaskDependencyDto {
  @IsString()
  taskId!: string;

  @IsString()
  dependsOnTaskId!: string;

  @IsEnum(DependencyType)
  type!: DependencyType;
}
