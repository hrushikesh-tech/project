"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { getNotifications, markNotificationRead } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

import { Button } from "@amdox/ui";

export function NotificationCenter() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: queryKeys.notifications,
    queryFn: () => getNotifications({ accessToken: session?.accessToken }),
  });

  const markReadMutation = useMutation({
    mutationFn: (notificationId: string) => markNotificationRead(notificationId),
    onSuccess: (items) => {
      queryClient.setQueryData(queryKeys.notifications, items);
    },
  });

  if (notifications.isLoading) {
    return <section className="surface" style={{ padding: "1.25rem" }}>Loading notifications...</section>;
  }

  return (
    <section className="surface" style={{ padding: "1.25rem", display: "grid", gap: "0.85rem" }}>
      <header>
        <div className="eyebrow">Notification center</div>
        <h2 style={{ marginBottom: "0.35rem" }}>In-shell inbox</h2>
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
          Inbox activity now lives inside the same protected shell as Finance, HR, Supply Chain, BI, and Projects.
        </p>
      </header>

      {(notifications.data ?? []).map((notification) => (
        <article
          key={notification.id}
          className="surface"
          style={{
            padding: "1rem",
            boxShadow: "none",
            borderColor: notification.isRead ? "rgba(15,23,42,0.08)" : "rgba(15,118,110,0.18)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div className="eyebrow">{notification.channel}</div>
              <strong style={{ display: "block", marginBottom: "0.35rem" }}>{notification.title}</strong>
              <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{notification.body}</p>
              <p style={{ marginBottom: 0, marginTop: "0.55rem", fontWeight: 600, color: notification.severity === "critical" ? "#b91c1c" : "var(--brand-strong)" }}>
                {notification.eventType}
              </p>
            </div>
            <div style={{ display: "grid", gap: "0.5rem", justifyItems: "end" }}>
              <span className="muted">{new Date(notification.createdAt).toLocaleString("en-IN")}</span>
              {!notification.isRead ? (
                <Button type="button" intent="ghost" size="sm" onClick={() => markReadMutation.mutate(notification.id)}>
                  Mark read
                </Button>
              ) : (
                <span className="pill">Read</span>
              )}
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}
