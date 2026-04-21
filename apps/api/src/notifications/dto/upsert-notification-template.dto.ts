import { IsIn, IsOptional, IsString } from "class-validator";

export class UpsertNotificationTemplateDto {
  @IsString()
  eventType!: string;

  @IsIn(["IN_APP", "EMAIL", "SMS", "WEBHOOK"])
  channel!: "IN_APP" | "EMAIL" | "SMS" | "WEBHOOK";

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  body!: string;
}
