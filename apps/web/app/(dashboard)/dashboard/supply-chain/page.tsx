"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { ModuleHomeHero } from "@/components/module-home/module-home-hero";
import { InventoryHeatmap } from "@/components/supply-chain/inventory-heatmap";
import { getInventoryHeatmap } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

import { Button } from "@amdox/ui";

export default function SupplyChainPage() {
  const { data: session } = useSession();
  const inventory = useQuery({
    queryKey: queryKeys.inventoryHeatmap,
    queryFn: () => getInventoryHeatmap({ accessToken: session?.accessToken }),
  });

  return (
    <section className="page-stack">
      <ModuleHomeHero
        eyebrow="Supply Chain"
        title="Warehouse pressure and inventory flow"
        description="This module keeps the operational shell dense, then uses the heatmap as the fast visual scan for stock health across warehouses and products."
        badge="UI-07 live"
      />

      <section className="surface" style={{ padding: "1.25rem", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">Inventory workspace</div>
          <h2 style={{ marginBottom: "0.35rem" }}>Heatmap and bounded stock semantics</h2>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            Use the visual grid for stock pressure, then move into warehouse and replenishment follow-through.
          </p>
        </div>
        <Link href="/dashboard/supply-chain/inventory">
          <Button type="button">Open inventory</Button>
        </Link>
      </section>

      {inventory.data ? <InventoryHeatmap dataset={inventory.data} /> : null}
    </section>
  );
}
