"use client";

import dynamic from "next/dynamic";
import { useState } from "react";

import { resolveRoleHome } from "@/lib/auth/role-home";

import { SidebarNav } from "./sidebar-nav";
import { Topbar } from "./topbar";

const OfflineBanner = dynamic(() => import("@/components/offline/offline-banner").then((mod) => mod.OfflineBanner), {
  ssr: false,
});
const SyncQueuePanel = dynamic(() => import("@/components/offline/sync-queue-panel").then((mod) => mod.SyncQueuePanel), {
  ssr: false,
});

type AppShellProps = {
  children: React.ReactNode;
  user: {
    email?: string | null;
    roles: string[];
    tenantId?: string;
  };
};

export function AppShell({ children, user }: AppShellProps) {
  const [navOpen, setNavOpen] = useState(false);
  const roleHome = resolveRoleHome(user.roles);

  return (
    <div className="shell-layout">
      <aside className={navOpen ? "shell-sidebar-wrap open" : "shell-sidebar-wrap"}>
        <SidebarNav />
      </aside>
      <div className="shell-main">
        <Topbar
          email={user.email ?? "unknown@amdox.local"}
          roles={user.roles}
          tenantId={user.tenantId}
          onToggleNav={() => setNavOpen((current) => !current)}
        />
        <OfflineBanner />
        <SyncQueuePanel />
        <section
          className="surface"
          style={{
            padding: "1rem 1.25rem",
            display: "grid",
            gap: "0.45rem",
          }}
        >
          <div className="eyebrow">Role Home First</div>
          <strong>{roleHome.title}</strong>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            {roleHome.description}
          </p>
          <span style={{ color: "var(--brand-strong)", fontWeight: 600 }}>{roleHome.emphasis}</span>
        </section>
        <div className="page-stack">{children}</div>
      </div>
    </div>
  );
}
