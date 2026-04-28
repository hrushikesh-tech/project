import {
  Injectable,
  OnApplicationShutdown,
  OnModuleDestroy,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

type AuthRequestContext = {
  ipAddress?: string;
  userAgent?: string;
};

type KeycloakTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  token_type?: string;
  session_state?: string;
};

type TokenPayload = {
  sub?: string;
  email?: string;
  jti?: string;
  sid?: string;
  exp?: number;
  iat?: number;
  tenant_id?: string | string[];
};

type UserSessionRecord = {
  id: string;
  tenantId: string;
  userId: string;
  keycloakSessionId: string;
  refreshTokenHash: string;
  status: string;
  issuedAt: Date;
  lastUsedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
  revocationReason?: string | null;
};

type UserSessionDelegate = {
  count(args: { where: Record<string, unknown> }): Promise<number>;
  findFirst(args: {
    where: Record<string, unknown>;
    orderBy?:
      | Record<string, "asc" | "desc">
      | Array<Record<string, "asc" | "desc">>;
  }): Promise<UserSessionRecord | null>;
  create(args: { data: Record<string, unknown> }): Promise<UserSessionRecord>;
  update(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<UserSessionRecord>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
};

@Injectable()
export class AuthService implements OnModuleDestroy, OnApplicationShutdown {
  private redis: Redis | null = null;
  private redisDisabled = false;
  private keycloakUrl: string;
  private realm: string;
  private clientId: string;
  private clientSecret: string;
  private readonly maxConcurrentSessions: number;
  private readonly refreshSessionTtlHours: number;
  private readonly blacklistEnabled: boolean;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    this.keycloakUrl = configService.get(
      "KEYCLOAK_URL",
      "http://localhost:8080",
    );
    this.realm = configService.get("KEYCLOAK_REALM", "amdox-erp");
    this.clientId = configService.get("KEYCLOAK_CLIENT_ID", "amdox-api");
    this.clientSecret =
      configService.get<string>("KEYCLOAK_CLIENT_SECRET") ?? "";
    this.maxConcurrentSessions = Number(
      configService.get("AUTH_MAX_CONCURRENT_SESSIONS", 5),
    );
    this.refreshSessionTtlHours = Number(
      configService.get("AUTH_REFRESH_SESSION_TTL_HOURS", 8),
    );
    this.blacklistEnabled =
      String(
        configService.get("AUTH_TOKEN_BLACKLIST_ENABLED", "true"),
      ).toLowerCase() !== "false";
  }

  async onModuleDestroy() {
    await this.shutdownRedis();
  }

  async onApplicationShutdown() {
    await this.shutdownRedis();
  }

  async login(
    username: string,
    password: string,
    context?: AuthRequestContext,
  ) {
    this.assertClientSecretConfigured();

    const response = await this.exchangeToken({
      grant_type: "password",
      username,
      password,
    });
    const claims = this.extractSessionClaims(response);
    await this.expireStaleSessions(claims.tenantId, claims.userId);

    const activeSessions = await this.getSessionDelegate().count({
      where: {
        tenantId: claims.tenantId,
        userId: claims.userId,
        status: "ACTIVE",
        revokedAt: null,
      },
    });

    if (activeSessions >= this.maxConcurrentSessions) {
      await this.logoutUpstream(response.refresh_token);
      throw new ForbiddenException(
        "Maximum active sessions reached. Sign out from another device before logging in again.",
      );
    }

    await this.upsertSessionRecord(response, claims, context, false);
    return response;
  }

  async refresh(refreshToken: string, context?: AuthRequestContext) {
    this.assertClientSecretConfigured();

    const refreshPayload = this.decodeToken(refreshToken);
    const claims = this.readClaimsFromPayload(refreshPayload);
    const session = await this.requireActiveSession(
      claims.tenantId,
      claims.userId,
      claims.sessionId,
    );

    if (session.revokedAt || session.status !== "ACTIVE") {
      throw new UnauthorizedException("Session has been revoked");
    }

    const presentedHash = this.hashToken(refreshToken);
    if (session.refreshTokenHash !== presentedHash) {
      await this.revokeSession(session.id, "refresh_token_replay");
      throw new UnauthorizedException("Refresh token has already been used");
    }

    let response: KeycloakTokenResponse;
    try {
      response = await this.exchangeToken({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      });
    } catch (error) {
      await this.revokeSession(session.id, "upstream_refresh_rejected");
      throw error;
    }

    const refreshedClaims = this.extractSessionClaims(response);
    await this.upsertSessionRecord(
      response,
      refreshedClaims,
      context,
      true,
      session.id,
    );
    return response;
  }

  async logout(
    accessToken: string,
    refreshToken: string,
    _context?: AuthRequestContext,
  ) {
    try {
      const payload = this.decodeToken(accessToken);
      const jti = payload.jti;
      const exp = payload.exp;
      const ttl =
        typeof exp === "number" ? exp - Math.floor(Date.now() / 1000) : 0;

      if (jti && ttl > 0) {
        const redis = await this.getRedisClient();
        if (redis) {
          await redis.setex(`token:blacklist:${jti}`, ttl, "revoked");
        }
      }
    } catch (e) {
      console.error("Failed to blacklist token:", e);
    }

    try {
      const refreshPayload = this.decodeToken(refreshToken);
      const claims = this.readClaimsFromPayload(refreshPayload);
      const tokenHash = this.hashToken(refreshToken);
      const session = await this.getSessionDelegate().findFirst({
        where: {
          tenantId: claims.tenantId,
          userId: claims.userId,
          keycloakSessionId: claims.sessionId,
          deletedAt: null,
        },
        orderBy: { updatedAt: "desc" },
      });

      if (session && session.refreshTokenHash === tokenHash) {
        await this.revokeSession(session.id, "logout");
      }
    } catch {
      // Logout should remain best-effort even if session bookkeeping cannot be resolved.
    }

    await this.logoutUpstream(refreshToken);
  }

  async cleanupSessionsForUser(
    tenantId: string,
    userId: string,
    reason = "gdpr_erasure",
  ) {
    const now = new Date();
    const result = await this.getSessionDelegate().updateMany({
      where: {
        tenantId,
        userId,
        deletedAt: null,
      },
      data: {
        status: "REVOKED",
        revokedAt: now,
        revocationReason: reason,
        deletedAt: now,
      },
    });

    return {
      tenantId,
      userId,
      cleanedAt: now,
      sessionCount: result.count,
    };
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    if (!this.blacklistEnabled) {
      return false;
    }

    const redis = await this.getRedisClient();
    if (!redis) {
      return false;
    }

    const result = await redis.get(`token:blacklist:${jti}`);
    return result === "revoked";
  }

  async getMe(userId: string) {
    return { userId };
  }

  private async exchangeToken(params: Record<string, string>) {
    const tokenUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        ...params,
      }),
    });
    if (!response.ok) {
      throw new UnauthorizedException("Invalid credentials or refresh token");
    }
    return (await response.json()) as KeycloakTokenResponse;
  }

  private async logoutUpstream(refreshToken: string) {
    const logoutUrl = `${this.keycloakUrl}/realms/${this.realm}/protocol/openid-connect/logout`;
    await fetch(logoutUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
      }),
    }).catch(() => {});
  }

  private async upsertSessionRecord(
    response: KeycloakTokenResponse,
    claims: { tenantId: string; userId: string; sessionId: string },
    context: AuthRequestContext | undefined,
    isRefresh: boolean,
    existingSessionId?: string,
  ) {
    const now = new Date();
    const refreshPayload = this.decodeToken(response.refresh_token);
    const issuedAt = this.toDate(refreshPayload.iat) ?? now;
    const expiresAt =
      this.toDate(refreshPayload.exp) ??
      new Date(now.getTime() + this.refreshSessionTtlHours * 60 * 60 * 1000);
    const sessionDelegate = this.getSessionDelegate();
    const payload = {
      tenantId: claims.tenantId,
      userId: claims.userId,
      keycloakSessionId: claims.sessionId,
      refreshTokenHash: this.hashToken(response.refresh_token),
      status: "ACTIVE",
      issuedAt,
      lastUsedAt: now,
      expiresAt,
      revokedAt: null,
      revocationReason: null,
      ipAddress: context?.ipAddress ?? null,
      userAgent: context?.userAgent ?? null,
      deletedAt: null,
    };

    if (isRefresh && existingSessionId) {
      await sessionDelegate.update({
        where: { id: existingSessionId },
        data: payload,
      });
      return;
    }

    await sessionDelegate.create({
      data: payload,
    });
  }

  private async expireStaleSessions(tenantId: string, userId: string) {
    await this.getSessionDelegate().updateMany({
      where: {
        tenantId,
        userId,
        status: "ACTIVE",
        expiresAt: { lte: new Date() },
        revokedAt: null,
      },
      data: {
        status: "EXPIRED",
        revokedAt: new Date(),
        revocationReason: "expired",
      },
    });
  }

  private async requireActiveSession(
    tenantId: string,
    userId: string,
    sessionId: string,
  ) {
    await this.expireStaleSessions(tenantId, userId);
    const session = await this.getSessionDelegate().findFirst({
      where: {
        tenantId,
        userId,
        keycloakSessionId: sessionId,
        deletedAt: null,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!session) {
      throw new UnauthorizedException("Session not found");
    }

    return session;
  }

  private async revokeSession(id: string, reason: string) {
    await this.getSessionDelegate().update({
      where: { id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });
  }

  private getSessionDelegate() {
    const delegate = (this.prisma.raw as unknown as Record<string, unknown>)
      .userSession;
    if (!delegate) {
      throw new ServiceUnavailableException(
        "UserSession Prisma model is unavailable. Regenerate the Prisma client for Phase 14.",
      );
    }

    return delegate as UserSessionDelegate;
  }

  private extractSessionClaims(response: KeycloakTokenResponse) {
    const accessPayload = this.decodeToken(response.access_token);
    const refreshPayload = this.decodeToken(response.refresh_token);
    const userId = accessPayload.sub ?? refreshPayload.sub;
    const tenantId =
      this.extractTenantId(accessPayload) ??
      this.extractTenantId(refreshPayload) ??
      "platform";
    const sessionId =
      response.session_state ??
      accessPayload.sid ??
      refreshPayload.sid ??
      accessPayload.jti ??
      refreshPayload.jti;

    if (!userId || !sessionId) {
      throw new UnauthorizedException(
        "Keycloak token response is missing user or session identity.",
      );
    }

    return { tenantId, userId, sessionId };
  }

  private readClaimsFromPayload(payload: TokenPayload) {
    const userId = payload.sub;
    const sessionId = payload.sid ?? payload.jti;
    const tenantId = this.extractTenantId(payload) ?? "platform";

    if (!userId || !sessionId) {
      throw new UnauthorizedException(
        "Refresh token is missing session identity",
      );
    }

    return { tenantId, userId, sessionId };
  }

  private extractTenantId(payload: TokenPayload) {
    const tenantClaim = Array.isArray(payload.tenant_id)
      ? payload.tenant_id[0]
      : payload.tenant_id;
    return typeof tenantClaim === "string" && tenantClaim.trim().length > 0
      ? tenantClaim
      : undefined;
  }

  private decodeToken(token: string): TokenPayload {
    const [, payload = ""] = token.split(".");
    if (!payload) {
      throw new UnauthorizedException("Token payload is missing");
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

    return JSON.parse(
      Buffer.from(padded, "base64").toString("utf8"),
    ) as TokenPayload;
  }

  private hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
  }

  private toDate(epochSeconds: number | undefined) {
    return typeof epochSeconds === "number"
      ? new Date(epochSeconds * 1000)
      : undefined;
  }

  private assertClientSecretConfigured() {
    if (!this.clientSecret) {
      throw new ServiceUnavailableException(
        "KEYCLOAK_CLIENT_SECRET must be configured before auth is enabled.",
      );
    }
  }

  private async getRedisClient() {
    if (this.redisDisabled) {
      return null;
    }

    if (!this.redis) {
      const redisUrl = this.configService.get<string>("REDIS_URL");
      this.redis = redisUrl
        ? new Redis(redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            retryStrategy: () => null,
          })
        : new Redis({
            host: this.configService.get("REDIS_HOST", "localhost"),
            port: this.configService.get("REDIS_PORT", 6379),
            lazyConnect: true,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
            retryStrategy: () => null,
          });

      this.redis.on("error", () => {
        this.redisDisabled = true;
      });
    }

    if (this.redis.status === "ready") {
      return this.redis;
    }

    if (this.redis.status === "wait") {
      try {
        await this.redis.connect();
        return this.redis;
      } catch {
        this.redisDisabled = true;
        this.redis.disconnect();
        return null;
      }
    }

    return this.redis.status === "ready" ? this.redis : null;
  }

  private async shutdownRedis() {
    if (!this.redis || this.redis.status === "end") {
      return;
    }

    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }
}
