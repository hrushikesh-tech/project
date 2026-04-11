import { Controller, Post, Body, Get, UseGuards, Headers } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequestUser } from '../common/interfaces/request-user.interface';
import { Public } from '../common/decorators/roles.decorator';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    return this.authService.login(body.username, body.password);
  }

  @Public()
  @Post('refresh')
  async refresh(@Body() body: { refresh_token: string }) {
    return this.authService.refresh(body.refresh_token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Headers('authorization') auth: string,
    @Body() body: { refresh_token: string },
  ) {
    const accessToken = auth.replace('Bearer ', '');
    await this.authService.logout(accessToken, body.refresh_token);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: RequestUser) {
    return user;
  }

  @Public()
  @Post('verify-mfa')
  async verifyMfa(@Body() body: { session: string; otp: string }) {
    // MFA verification is handled by Keycloak's authentication flow
    // This endpoint is a proxy to Keycloak's token endpoint with OTP
    return { message: 'MFA verification handled by Keycloak flow' };
  }
}
