type GanttTimelineProps = {
  labels: string[];
};

export function GanttTimeline({ labels }: GanttTimelineProps) {
  return (
    <div style={{ display: "grid", gridAutoFlow: "column", gridAutoColumns: "120px", gap: "0.5rem", marginBottom: "1rem" }}>
      {labels.map((label) => (
        <div key={label} className="eyebrow">
          {label}
        </div>
      ))}
    </div>
  );
}
