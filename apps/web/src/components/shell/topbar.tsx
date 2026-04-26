"use client";

import { LogOut, Menu, ShieldCheck } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@amdox/ui";

type TopbarProps = {
  email: string;
  roles: string[];
  tenantId?: string;
  onToggleNav?: () => void;
};

export function Topbar({ email, roles, tenantId, onToggleNav }: TopbarProps) {
  return (
    <header
      className="surface"
      style={{
        padding: "1rem 1.25rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "1rem",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={onToggleNav}
          className="focus-ring"
          style={{
            width: "2.6rem",
            height: "2.6rem",
            borderRadius: "999px",
            border: "1px solid rgba(15,23,42,0.12)",
            background: "#fff",
            display: "grid",
            placeItems: "center",
            cursor: "pointer",
          }}
          aria-label="Toggle navigation"
        >
          <Menu size={18} />
        </button>
        <div>
          <div className="eyebrow">Protected Session</div>
          <strong style={{ display: "block" }}>{email}</strong>
        </div>
        <div className="pill">
          <ShieldCheck size={16} />
          {tenantId ?? "tenant-unassigned"}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <div className="muted" style={{ fontSize: "0.95rem" }}>
          Roles: {roles.join(", ")}
        </div>
        <Button
          type="button"
          intent="ghost"
          onClick={() => void signOut({ callbackUrl: "/login" })}
        >
          <LogOut size={16} />
          Sign out
        </Button>
      </div>
    </header>
  );
}
