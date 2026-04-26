import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";

import {
  loginWithPassword,
  logoutWithToken,
  refreshAccessToken,
  type BackendUser,
  type BackendTokenResponse,
} from "@/lib/auth/session";
import { resolveRoleHomeHref } from "@/lib/auth/role-home";

type AppUser = {
  id: string;
  email: string;
  roles: string[];
  tenantId?: string;
  accessToken: string;
  refreshToken: string;
  accessTokenExpires: number;
  refreshTokenExpires?: number;
  roleHome: string;
};

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: "RefreshAccessTokenError";
    user: DefaultSession["user"] & {
      id: string;
      roles: string[];
      tenantId?: string;
      roleHome: string;
    };
  }

  interface User {
    id: string;
    email: string;
    roles: string[];
    tenantId?: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
    refreshTokenExpires?: number;
    roleHome: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    refreshTokenExpires?: number;
    roles: string[];
    tenantId?: string;
    roleHome: string;
    error?: "RefreshAccessTokenError";
  }
}

function toSessionUser(user: BackendUser, tokens: BackendTokenResponse): AppUser {
  const roleHome = resolveRoleHomeHref(user.roles);

  return {
    id: user.userId,
    email: user.email,
    roles: user.roles,
    tenantId: user.tenantId,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    accessTokenExpires: Date.now() + tokens.expires_in * 1000,
    refreshTokenExpires: tokens.refresh_expires_in
      ? Date.now() + tokens.refresh_expires_in * 1000
      : undefined,
    roleHome,
  };
}

function createBypassUser(username: string): AppUser {
  const roles = ["tenant_admin"];
  const roleHome = resolveRoleHomeHref(roles);

  return {
    id: "phase15-bypass-user",
    email: username,
    roles,
    tenantId: "tenant-1",
    accessToken: "phase15-bypass-access-token",
    refreshToken: "phase15-bypass-refresh-token",
    accessTokenExpires: Date.now() + 60 * 60 * 1000,
    refreshTokenExpires: Date.now() + 8 * 60 * 60 * 1000,
    roleHome,
  };
}

if (!process.env.AUTH_SECRET) {
  throw new Error(
    "AUTH_SECRET must be configured before starting the web auth runtime.",
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "Keycloak",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const username = String(credentials?.username ?? "").trim();
        const password = String(credentials?.password ?? "");

        if (!username || !password) {
          return null;
        }

        if (process.env.PLAYWRIGHT_TEST_BYPASS_AUTH === "1") {
          return createBypassUser(username);
        }

        const result = await loginWithPassword(username, password);
        return toSessionUser(result.user, result.tokens);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const authUser = user as AppUser;
        token.sub = authUser.id;
        token.email = authUser.email ?? token.email;
        token.roles = authUser.roles;
        token.tenantId = authUser.tenantId;
        token.accessToken = authUser.accessToken;
        token.refreshToken = authUser.refreshToken;
        token.accessTokenExpires = authUser.accessTokenExpires;
        token.refreshTokenExpires = authUser.refreshTokenExpires;
        token.roleHome = authUser.roleHome;
        token.error = undefined;
        return token;
      }

      if (!token.accessTokenExpires || Date.now() < token.accessTokenExpires - 30_000) {
        return token;
      }

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.error = token.error;
      session.user = {
        ...session.user,
        id: token.sub ?? "",
        email: token.email ?? "",
        roles: token.roles ?? [],
        tenantId: token.tenantId,
        roleHome: token.roleHome ?? "/dashboard",
      };

      return session;
    },
    authorized({ auth: session, request }) {
      const pathname = request.nextUrl.pathname;
      const isDashboardPath = pathname.startsWith("/dashboard");

      if (isDashboardPath) {
        return Boolean(session?.user);
      }

      return true;
    },
  },
  events: {
    async signOut(message) {
      const token = "token" in message ? message.token : null;
      if (token?.accessToken && token.refreshToken) {
        await logoutWithToken(token.accessToken, token.refreshToken);
      }
    },
  },
});
