"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { InventoryHeatmap } from "@/components/supply-chain/inventory-heatmap";
import { getInventoryHeatmap } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

export default function SupplyChainInventoryPage() {
  const { data: session } = useSession();
  const inventory = useQuery({
    queryKey: queryKeys.inventoryHeatmap,
    queryFn: () => getInventoryHeatmap({ accessToken: session?.accessToken }),
  });

  if (!inventory.data) {
    return <section className="surface" style={{ padding: "1.25rem" }}>Loading inventory heatmap...</section>;
  }

  return <InventoryHeatmap dataset={inventory.data} />;
}
