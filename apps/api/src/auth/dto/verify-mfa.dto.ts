import { IsNotEmpty, IsString, Matches } from "class-validator";

export class VerifyMfaDto {
  @IsString()
  @IsNotEmpty()
  session!: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: "OTP must be a 6-digit code." })
  otp!: string;
}
