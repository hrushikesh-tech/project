"use client";

import { useEffect, useState } from "react";

import { isEffectivelyOnline } from "@/lib/offline/sync";

export function OfflineBanner() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const refresh = () => setOnline(isEffectivelyOnline());
    refresh();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);
    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  if (online) {
    return null;
  }

  return (
    <section
      className="surface"
      style={{
        padding: "0.9rem 1rem",
        background: "rgba(245,158,11,0.12)",
        borderColor: "rgba(245,158,11,0.25)",
        boxShadow: "none",
      }}
    >
      <strong style={{ display: "block", marginBottom: "0.2rem" }}>Offline mode enabled</strong>
      <span className="muted">
        Core routes stay available, low-risk preferences can queue, and high-risk finance, payroll, inventory, and dependency changes stay online-only.
      </span>
    </section>
  );
}
