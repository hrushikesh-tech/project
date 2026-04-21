import { IsBoolean, IsIn, IsString } from "class-validator";

export class UpdateNotificationPreferencesDto {
  @IsString()
  eventType!: string;

  @IsIn(["IN_APP", "EMAIL", "SMS", "WEBHOOK"])
  channel!: "IN_APP" | "EMAIL" | "SMS" | "WEBHOOK";

  @IsBoolean()
  enabled!: boolean;
}
