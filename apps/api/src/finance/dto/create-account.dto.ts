import { AccountType } from '@amdox/db';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateAccountDto {
  @IsString()
  legalEntityId!: string;

  @IsString()
  @Length(2, 20)
  code!: string;

  @IsString()
  @Length(2, 150)
  name!: string;

  @IsEnum(AccountType)
  type!: AccountType;

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
