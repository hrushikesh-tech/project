import type { JWT } from "next-auth/jwt";
import {
  parseApiError,
  unwrapApiEnvelope,
  type ApiEnvelope,
  type ApiErrorEnvelope,
} from "../api/envelope";

export type BackendUser = {
  userId: string;
  email: string;
  roles: string[];
  tenantId?: string;
};

export type BackendTokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  refresh_expires_in?: number;
  token_type?: string;
};

const DEFAULT_API_URL = "http://localhost:3001/api/v1";
const DEFAULT_AUTH_TENANT_ID = "tenant-1";

function getApiBaseUrl() {
  return (
    process.env.AUTH_API_URL ??
    process.env.NEXT_PUBLIC_API_URL ??
    DEFAULT_API_URL
  );
}

function getAuthTenantId() {
  return (
    process.env.AUTH_TENANT_ID ??
    process.env.NEXT_PUBLIC_AUTH_TENANT_ID ??
    process.env.PHASE15_TENANT_ID ??
    DEFAULT_AUTH_TENANT_ID
  );
}

async function authRequest<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? ((await response.json()) as T | ApiEnvelope<T> | ApiErrorEnvelope)
    : await response.text();

  if (!response.ok) {
    throw parseApiError(
      payload as string | ApiErrorEnvelope | null,
      response.status,
      `Auth request failed: ${path}`,
    );
  }

  return unwrapApiEnvelope(payload as T | ApiEnvelope<T>);
}

async function fetchProfile(accessToken: string) {
  return authRequest<BackendUser>("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-tenant-id": getAuthTenantId(),
    },
  });
}

export async function loginWithPassword(username: string, password: string) {
  const tokens = await authRequest<BackendTokenResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });

  const user = await fetchProfile(tokens.access_token);
  return { tokens, user };
}

export async function logoutWithToken(
  accessToken: string,
  refreshToken: string,
) {
  try {
    await authRequest<{ message: string }>("/auth/logout", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-tenant-id": getAuthTenantId(),
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  } catch {
    // Keep logout resilient; NextAuth should still clear the session even if the API call fails.
  }
}

export async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return { ...token, error: "RefreshAccessTokenError" };
  }

  try {
    const refreshed = await authRequest<BackendTokenResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token: token.refreshToken }),
    });

    const user = await fetchProfile(refreshed.access_token);

    return {
      ...token,
      sub: user.userId,
      email: user.email,
      roles: user.roles,
      tenantId: user.tenantId,
      roleHome: token.roleHome,
      accessToken: refreshed.access_token,
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshTokenExpires: refreshed.refresh_expires_in
        ? Date.now() + refreshed.refresh_expires_in * 1000
        : token.refreshTokenExpires,
      error: undefined,
    };
  } catch {
    const nextRefreshToken =
      token.refreshTokenExpires && Date.now() >= token.refreshTokenExpires
        ? undefined
        : token.refreshToken;

    return {
      ...token,
      refreshToken: nextRefreshToken,
      error: "RefreshAccessTokenError",
    };
  }
}
