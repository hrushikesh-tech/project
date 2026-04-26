"use client";

import { useMemo } from "react";

import type { InventoryHeatmapDataset } from "@/lib/api/client";

type InventoryHeatmapProps = {
  dataset: InventoryHeatmapDataset;
};

function cellTone(onHand: number, reorderPoint: number) {
  if (onHand < reorderPoint) {
    return "rgba(185,28,28,0.16)";
  }

  if (onHand === reorderPoint) {
    return "rgba(245,158,11,0.18)";
  }

  return "rgba(15,118,110,0.16)";
}

export function InventoryHeatmap({ dataset }: InventoryHeatmapProps) {
  const warehouses = useMemo(
    () => Array.from(new Set(dataset.cells.map((cell) => cell.warehouseName))),
    [dataset.cells],
  );
  const products = useMemo(
    () => Array.from(new Set(dataset.cells.map((cell) => cell.productName))),
    [dataset.cells],
  );

  return (
    <section className="surface" style={{ padding: "1.25rem", display: "grid", gap: "1rem" }}>
      <header>
        <div className="eyebrow">Inventory heatmap</div>
        <h2 style={{ marginBottom: "0.35rem" }}>{dataset.title}</h2>
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
          Every cell exposes warehouse, product, available stock, and reorder-point state so keyboard and screen-reader users get the same inventory signal.
        </p>
      </header>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: "0.5rem", minWidth: "680px" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Warehouse</th>
              {products.map((product) => (
                <th key={product} style={{ textAlign: "left" }}>{product}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {warehouses.map((warehouse) => (
              <tr key={warehouse}>
                <th style={{ textAlign: "left", verticalAlign: "top", paddingTop: "0.75rem" }}>{warehouse}</th>
                {products.map((product) => {
                  const cell = dataset.cells.find((item) => item.warehouseName === warehouse && item.productName === product);
                  if (!cell) {
                    return <td key={`${warehouse}-${product}`} />;
                  }

                  return (
                    <td key={`${warehouse}-${product}`}>
                      <div
                        tabIndex={0}
                        aria-label={`${warehouse} ${product} has ${cell.available} available units and reorder point ${cell.reorderPoint}`}
                        style={{
                          padding: "0.9rem",
                          borderRadius: "18px",
                          background: cellTone(cell.onHand, cell.reorderPoint),
                          border: "1px solid rgba(15,23,42,0.08)",
                          minHeight: "120px",
                          display: "grid",
                          gap: "0.35rem",
                        }}
                      >
                        <strong>{cell.available}</strong>
                        <span className="muted">On hand: {cell.onHand}</span>
                        <span className="muted">Reorder: {cell.reorderPoint}</span>
                        <span style={{ fontWeight: 600, color: cell.available < cell.reorderPoint ? "#b91c1c" : "var(--brand-strong)" }}>
                          {cell.available < cell.reorderPoint ? "Below reorder point" : "Healthy stock"}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
