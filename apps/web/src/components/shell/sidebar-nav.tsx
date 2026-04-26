"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { shellNavItems } from "@/lib/routes";

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="shell-sidebar surface">
      <div className="page-stack">
        <div>
          <div className="eyebrow">Amdox ERP</div>
          <h2 style={{ marginBottom: "0.4rem" }}>Unified shell</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.55 }}>
            Finance, HR, Supply Chain, BI, Projects, and Notifications stay inside one keyboard-friendly frame.
          </p>
        </div>

        <div style={{ display: "grid", gap: "0.65rem" }}>
          {shellNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;

            if (item.disabled) {
              return (
                <div
                  key={item.href}
                  style={{
                    borderRadius: "18px",
                    border: "1px dashed rgba(15,23,42,0.12)",
                    padding: "0.85rem 0.95rem",
                    opacity: 0.72,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", fontWeight: 700 }}>
                    <Icon size={18} />
                    {item.label}
                  </div>
                  <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.9rem" }}>
                    {item.description}
                  </p>
                </div>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  borderRadius: "18px",
                  padding: "0.85rem 0.95rem",
                  border: isActive
                    ? "1px solid rgba(15,118,110,0.24)"
                    : "1px solid rgba(15,23,42,0.08)",
                  background: isActive ? "rgba(15,118,110,0.12)" : "rgba(255,255,255,0.7)",
                  display: "grid",
                  gap: "0.35rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", fontWeight: 700 }}>
                  <Icon size={18} />
                  {item.label}
                </div>
                <span className="muted" style={{ fontSize: "0.9rem" }}>
                  {item.description}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
