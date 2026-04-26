"use client";

import type { QueryClient } from "@tanstack/react-query";

import { queryKeys } from "@/lib/query/keys";

export function connectDashboardStream(queryClient: QueryClient, dashboardId: string) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const browserWindow = window;
  const streamUrl = `${window.location.origin}/api/mock/bi/dashboards/${dashboardId}/stream`;
  let fallbackIntervalId: number | null = null;

  const startFallback = () => {
    if (fallbackIntervalId !== null) {
      return;
    }

    fallbackIntervalId = browserWindow.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics(dashboardId) });
    }, 12000);
  };

  if ("EventSource" in window) {
    const source = new EventSource(streamUrl);
    source.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.dashboardMetrics(dashboardId) });
    };
    source.onerror = () => {
      source.close();
      startFallback();
    };
    return () => {
      source.close();
      if (fallbackIntervalId !== null) {
        browserWindow.clearInterval(fallbackIntervalId);
      }
    };
  }

  startFallback();
  return () => {
    if (fallbackIntervalId !== null) {
      browserWindow.clearInterval(fallbackIntervalId);
    }
  };
}
