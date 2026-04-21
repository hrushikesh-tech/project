import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
} from "class-validator";

export class UpsertWebhookConfigDto {
  @IsUrl({
    require_tld: false,
  })
  url!: string;

  @IsString()
  secret!: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  events!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
