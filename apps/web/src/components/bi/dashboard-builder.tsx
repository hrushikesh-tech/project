"use client";

import { useEffect, useMemo, useState } from "react";
import GridLayout, { type Layout } from "react-grid-layout";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import {
  getDashboard,
  getDashboardMetrics,
  saveDashboardLayout,
  type DashboardWidgetRecord,
} from "@/lib/api/client";
import { connectDashboardStream } from "@/lib/bi/dashboard-stream";
import { queryKeys } from "@/lib/query/keys";

import { WidgetPalette } from "./widget-palette";

type DashboardBuilderProps = {
  dashboardId: string;
};

export function DashboardBuilder({ dashboardId }: DashboardBuilderProps) {
  const { data: session } = useSession();
  const accessToken = session?.accessToken;
  const queryClient = useQueryClient();
  const dashboard = useQuery({
    queryKey: queryKeys.dashboard(dashboardId),
    queryFn: () => getDashboard(dashboardId, { accessToken }),
  });
  const metrics = useQuery({
    queryKey: queryKeys.dashboardMetrics(dashboardId),
    queryFn: () => getDashboardMetrics(dashboardId, { accessToken }),
  });
  const [widgets, setWidgets] = useState<DashboardWidgetRecord[]>([]);

  useEffect(() => {
    if (dashboard.data?.widgets) {
      setWidgets(dashboard.data.widgets);
    }
  }, [dashboard.data?.widgets]);

  useEffect(() => connectDashboardStream(queryClient, dashboardId), [dashboardId, queryClient]);

  const layout = useMemo<Layout>(
    () =>
      widgets.map((widget) => ({
        i: widget.id,
        x: widget.layout.x,
        y: widget.layout.y,
        w: widget.layout.w,
        h: widget.layout.h,
      })),
    [widgets],
  );

  function addWidget(metricKey: DashboardWidgetRecord["metricKey"]) {
    setWidgets((current) => [
      ...current,
      {
        id: `widget-${current.length + 1}`,
        title: metricKey.replaceAll("_", " "),
        metricKey,
        type: "stat",
        layout: { x: (current.length * 3) % 12, y: Infinity, w: 3, h: 2 },
      },
    ]);
  }

  function handleLayoutChange(nextLayout: Layout) {
    const updated = widgets.map((widget) => {
      const item = nextLayout.find((layoutItem) => layoutItem.i === widget.id);
      return item
        ? {
            ...widget,
            layout: { x: item.x, y: item.y, w: item.w, h: item.h },
          }
        : widget;
    });

    setWidgets(updated);
    void saveDashboardLayout(dashboardId, updated);
  }

  return (
    <section className="page-stack">
      <section className="surface" style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}>
        <div>
          <div className="eyebrow">Dashboard builder</div>
          <h2 style={{ marginBottom: "0.35rem" }}>{dashboard.data?.name ?? "Dashboard"}</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            Layout is flexible, but the metric semantics stay fixed to approved BI widgets only.
          </p>
        </div>
        <div className="grid-cards" style={{ gridTemplateColumns: "260px minmax(0, 1fr)" }}>
          <WidgetPalette onAdd={addWidget} />
          <section className="surface" style={{ padding: "1rem", boxShadow: "none", overflowX: "auto" }}>
            <GridLayout
              className="layout"
              layout={layout}
              cols={12}
              rowHeight={48}
              width={860}
              onLayoutChange={handleLayoutChange}
            >
              {widgets.map((widget) => {
                const metric = metrics.data?.find((item) => item.widgetId === widget.id);
                return (
                  <article
                    key={widget.id}
                    className="surface"
                    style={{ padding: "0.9rem", boxShadow: "none", display: "grid", gap: "0.5rem" }}
                  >
                    <div className="eyebrow">{widget.metricKey.replaceAll("_", " ")}</div>
                    <strong>{metric?.summary ?? "Waiting for metric refresh"}</strong>
                    <div style={{ display: "grid", gap: "0.35rem" }}>
                      {(metric?.points ?? []).slice(0, 4).map((point) => (
                        <div key={point.label} style={{ display: "flex", justifyContent: "space-between", gap: "0.5rem" }}>
                          <span className="muted">{point.label}</span>
                          <span>{point.value}</span>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </GridLayout>
          </section>
        </div>
      </section>
    </section>
  );
}
