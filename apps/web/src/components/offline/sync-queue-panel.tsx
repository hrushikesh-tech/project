"use client";

import { useEffect, useState } from "react";

import { flushOfflineQueue, isEffectivelyOnline, subscribeOfflineQueue } from "@/lib/offline/sync";
import type { OfflineAction } from "@/lib/offline/policy";

import { Button } from "@amdox/ui";

export function SyncQueuePanel() {
  const [queue, setQueue] = useState<OfflineAction[]>([]);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = subscribeOfflineQueue(setQueue);
    return () => {
      unsubscribe();
    };
  }, []);

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

  if (!queue.length && online) {
    return null;
  }

  return (
    <section className="surface" style={{ padding: "0.9rem 1rem", boxShadow: "none", display: "grid", gap: "0.75rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Sync queue</div>
          <strong>{queue.length} queued action{queue.length === 1 ? "" : "s"}</strong>
        </div>
        <Button
          type="button"
          intent="ghost"
          size="sm"
          disabled={!online || !queue.length}
          onClick={async () => {
            const flushed = await flushOfflineQueue();
            setMessage(`Replayed ${flushed.length} queued action${flushed.length === 1 ? "" : "s"}.`);
          }}
        >
          Sync now
        </Button>
      </div>
      {queue.map((item) => (
        <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
          <span>{item.type}</span>
          <span className="muted">{new Date(item.queuedAt).toLocaleTimeString("en-IN")}</span>
        </div>
      ))}
      {message ? <span className="muted">{message}</span> : null}
      {!online ? <span className="muted">Queue replay resumes automatically when connectivity returns.</span> : null}
    </section>
  );
}
