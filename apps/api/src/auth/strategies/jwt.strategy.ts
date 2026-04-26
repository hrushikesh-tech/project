import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { RequestUser } from '../../common/interfaces/request-user.interface';
import { AuthService } from '../auth.service';

const SUPER_ADMIN_EXPANDED_ROLES = [
  'super_admin',
  'tenant_admin',
  'finance_manager',
  'hr_manager',
  'supply_chain_manager',
  'project_manager',
  'viewer',
] as const;

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    const keycloakUrl = configService.get<string>('KEYCLOAK_URL', 'http://localhost:8080');
    const realm = configService.get<string>('KEYCLOAK_REALM', 'amdox-erp');

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      issuer: `${keycloakUrl}/realms/${realm}`,
      algorithms: ['RS256'],
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
    });
  }

  async validate(payload: any): Promise<RequestUser> {
    if (payload.jti && await this.authService.isTokenBlacklisted(payload.jti)) {
      throw new UnauthorizedException('Token has been revoked');
    }

    const baseRoles = Array.isArray(payload.realm_access?.roles)
      ? payload.realm_access.roles
      : [];
    const roles = baseRoles.includes('super_admin')
      ? [...new Set([...baseRoles, ...SUPER_ADMIN_EXPANDED_ROLES])]
      : baseRoles;
    const tenantClaim = Array.isArray(payload.tenant_id) ? payload.tenant_id[0] : payload.tenant_id;
    const tenantId =
      typeof tenantClaim === 'string' && tenantClaim.trim().length > 0
        ? tenantClaim
        : undefined;

    return {
      userId: payload.sub,
      email: payload.email,
      roles,
      tenantId,
      sessionId: payload.sid ?? payload.session_state,
      jti: payload.jti,
    };
  }
}
