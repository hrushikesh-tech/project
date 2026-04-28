import type { LedgerAccountType } from "@amdox/types";
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
} from "class-validator";

const ledgerAccountTypes = [
  "ASSET",
  "LIABILITY",
  "EQUITY",
  "REVENUE",
  "EXPENSE",
] as const;

export class CreateAccountDto {
  @IsString()
  legalEntityId!: string;

  @IsString()
  @Length(2, 20)
  code!: string;

  @IsString()
  @Length(2, 150)
  name!: string;

  @IsIn(ledgerAccountTypes)
  type!: LedgerAccountType;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
}
