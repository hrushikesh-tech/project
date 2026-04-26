"use client";

import { flushOfflineQueue } from "@/lib/offline/sync";

export const CORE_ROUTE_CACHE = "amdox-core-routes-v1";

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  void navigator.serviceWorker.register("/sw.js").catch(() => undefined);

  window.addEventListener("online", () => {
    void flushOfflineQueue();
  });
}
