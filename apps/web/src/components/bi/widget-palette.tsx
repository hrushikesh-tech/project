"use client";

import { BI_METRIC_KEYS, type BiMetricKey } from "@amdox/types";

import { Button } from "@amdox/ui";

type WidgetPaletteProps = {
  onAdd: (metricKey: BiMetricKey) => void;
};

export function WidgetPalette({ onAdd }: WidgetPaletteProps) {
  return (
    <section className="surface" style={{ padding: "1rem", display: "grid", gap: "0.65rem" }}>
      <div className="eyebrow">Approved widgets</div>
      {BI_METRIC_KEYS.map((metricKey) => (
        <Button key={metricKey} type="button" intent="ghost" size="sm" style={{ justifyContent: "space-between" }} onClick={() => onAdd(metricKey)}>
          {metricKey.replaceAll("_", " ")}
        </Button>
      ))}
    </section>
  );
}
