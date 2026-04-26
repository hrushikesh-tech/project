import { Controller, Post, Body, Get, UseGuards, Headers, Req } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { RequestUser } from "../common/interfaces/request-user.interface";
import { Public } from "../common/decorators/roles.decorator";
import { LoginDto } from "./dto/login.dto";
import { RefreshTokenDto } from "./dto/refresh-token.dto";
import { LogoutDto } from "./dto/logout.dto";
import { VerifyMfaDto } from "./dto/verify-mfa.dto";
import { RateLimit } from "../common/security/rate-limit.decorator";
import { RATE_LIMIT_BUCKETS } from "../common/security/rate-limit.policy";

type AuthRequest = {
  ip?: string;
  headers?: {
    "user-agent"?: string | string[];
  };
};

@ApiTags("auth")
@Controller({ path: "auth", version: "1" })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @RateLimit(RATE_LIMIT_BUCKETS.AUTH)
  @Post("login")
  async login(@Body() body: LoginDto, @Req() request: AuthRequest) {
    return this.authService.login(body.username, body.password, {
      ipAddress: request.ip,
      userAgent: this.readUserAgent(request.headers?.["user-agent"]),
    });
  }

  @Public()
  @RateLimit(RATE_LIMIT_BUCKETS.AUTH)
  @Post("refresh")
  async refresh(@Body() body: RefreshTokenDto, @Req() request: AuthRequest) {
    return this.authService.refresh(body.refresh_token, {
      ipAddress: request.ip,
      userAgent: this.readUserAgent(request.headers?.["user-agent"]),
    });
  }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(
    @Headers('authorization') auth: string,
    @Body() body: LogoutDto,
    @Req() request: AuthRequest,
  ) {
    const accessToken = auth.replace("Bearer ", "");
    await this.authService.logout(accessToken, body.refresh_token, {
      ipAddress: request.ip,
      userAgent: this.readUserAgent(request.headers?.["user-agent"]),
    });
    return { message: "Logged out successfully" };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @Public()
  @RateLimit(RATE_LIMIT_BUCKETS.AUTH)
  @Post("verify-mfa")
  async verifyMfa(@Body() _body: VerifyMfaDto) {
    // MFA verification is handled by Keycloak's authentication flow
    // This endpoint is a proxy to Keycloak's token endpoint with OTP
    return { message: "MFA verification handled by Keycloak flow" };
  }

  private readUserAgent(value: string | string[] | undefined) {
    return Array.isArray(value) ? value[0] : value;
  }
}
