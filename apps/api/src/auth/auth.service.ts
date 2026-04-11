import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class AuthService {
  private redis: Redis;
  private keycloakUrl: string;
  private realm: string;
  private clientId: string;
  private clientSecret: string;

  constructor(private configService: ConfigService) {
    this.redis = new Redis({
      host: configService.get('REDIS_HOST', 'localhost'),
      port: configService.get('REDIS_PORT', 6379),
    });
    this.keycloakUrl = configService.get('KEYCLOAK_URL', 'http://localhost:8080');
    this.realm = configService.get('KEYCLOAK_REALM', 'amdox-erp');
    this.clientId = configService.get('KEYCLOAK_CLIENT_ID', 'amdox-api');
    this.clientSecret = configService.get('KEYCLOAK_CLIENT_SECRET', 'amdox-api-dev-secret');
  }

  async login(username: string, password: string) {
    const tokenUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        username,
        password,
      }),
    });
    if (!response.ok) throw new UnauthorizedException('Invalid credentials');
    return response.json();
  }

  async refresh(refreshToken: string) {
    const tokenUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    });
    if (!response.ok) throw new UnauthorizedException('Invalid refresh token');
    return response.json();
  }

  async logout(accessToken: string, refreshToken: string) {
    // Decode token to get jti for blacklist
    try {
      const payload = JSON.parse(
        Buffer.from(accessToken.split('.')[1], 'base64').toString(),
      );
      const jti = payload.jti;
      const exp = payload.exp;
      const ttl = exp - Math.floor(Date.now() / 1000);

      // Blacklist the access token in Redis
      if (jti && ttl > 0) {
        await this.redis.setex(`token:blacklist:${jti}`, ttl, 'revoked');
      }
    } catch (e) {
      console.error('Failed to blacklist token:', e);
    }

    // Also invalidate at Keycloak
    const logoutUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/logout`;
    await fetch(logoutUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    }).catch(() => {});
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    const result = await this.redis.get(`token:blacklist:${jti}`);
    return result === 'revoked';
  }

  async getMe(userId: string) {
    // Returns user info from JWT — can be enriched with DB data later
    return { userId };
  }
}
