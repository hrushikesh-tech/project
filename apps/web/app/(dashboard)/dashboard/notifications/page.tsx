"use client";

import Link from "next/link";

import { ModuleHomeHero } from "@/components/module-home/module-home-hero";
import { NotificationCenter } from "@/components/notifications/notification-center";

import { Button } from "@amdox/ui";

export default function NotificationsPage() {
  return (
    <section className="page-stack">
      <ModuleHomeHero
        eyebrow="Notifications"
        title="In-shell inbox and delivery preferences"
        description="Notifications now have a real center inside the shell. Preferences still live nearby, but the inbox is the operational surface for what needs attention right now."
        badge="Inbox live"
      />

      <section className="surface" style={{ padding: "1.25rem", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Preferences</div>
          <h2 style={{ marginBottom: "0.35rem" }}>Channel and event controls</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            Switch to preferences for event-level routing and channel controls.
          </p>
        </div>
        <Link href="/dashboard/notifications/preferences">
          <Button type="button">Open preferences</Button>
        </Link>
      </section>

      <NotificationCenter />
    </section>
  );
}
