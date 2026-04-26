"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { DashboardBuilder } from "@/components/bi/dashboard-builder";
import { ModuleHomeHero } from "@/components/module-home/module-home-hero";
import { getDashboards } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

import { Button } from "@amdox/ui";

export default function BiPage() {
  const { data: session } = useSession();
  const dashboards = useQuery({
    queryKey: queryKeys.dashboards,
    queryFn: () => getDashboards({ accessToken: session?.accessToken }),
  });
  const dashboard = dashboards.data?.[0];

  return (
    <section className="page-stack">
      <ModuleHomeHero
        eyebrow="BI"
        title="Fixed-semantics dashboard builder"
        description="Drag, resize, and reorder approved widgets while metric meaning stays locked to the BI contracts defined upstream."
        badge="UI-08 live"
      />

      {dashboard ? (
        <>
          <section className="surface" style={{ padding: "1.25rem", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <div className="eyebrow">Builder workspace</div>
              <h2 style={{ marginBottom: "0.35rem" }}>{dashboard.name}</h2>
              <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{dashboard.description}</p>
            </div>
            <Link href={`/dashboard/bi/${dashboard.id}`}>
              <Button type="button">Open builder</Button>
            </Link>
          </section>
          <DashboardBuilder dashboardId={dashboard.id} />
        </>
      ) : null}
    </section>
  );
}
