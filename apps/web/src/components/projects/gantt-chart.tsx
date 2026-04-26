"use client";

import { scaleTime } from "d3";
import { useMemo, useState } from "react";

import type { ProjectDependencyRecord, ProjectTaskRecord } from "@/lib/api/client";
import { buildGanttLayout } from "@/lib/projects/gantt-layout";

import { GanttTimeline } from "./gantt-timeline";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatLabel(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

type GanttChartProps = {
  tasks: ProjectTaskRecord[];
  dependencies: ProjectDependencyRecord[];
  onReschedule?: (taskId: string, start: string, end: string) => void;
};

export function GanttChart({ tasks, dependencies, onReschedule }: GanttChartProps) {
  const [taskOverrides, setTaskOverrides] = useState<Record<string, { start: string; end: string }>>({});

  const effectiveTasks = tasks.map((task) => ({
    ...task,
    start: taskOverrides[task.id]?.start ?? task.start,
    end: taskOverrides[task.id]?.end ?? task.end,
  }));

  const layout = useMemo(() => buildGanttLayout(effectiveTasks, dependencies), [effectiveTasks, dependencies]);
  const starts = effectiveTasks.map((task) => new Date(task.start));
  const ends = effectiveTasks.map((task) => new Date(task.end));
  const minStart = new Date(Math.min(...starts.map((value) => value.getTime())));
  const maxEnd = new Date(Math.max(...ends.map((value) => value.getTime())));
  const scale = scaleTime().domain([minStart, maxEnd]).range([0, layout.totalWidth]);
  const labels = Array.from({ length: 6 }, (_, index) => formatLabel(addDays(minStart, index * 7)));

  function shiftTask(taskId: string, days: number) {
    const current = effectiveTasks.find((task) => task.id === taskId);
    if (!current) {
      return;
    }

    const nextStart = addDays(new Date(current.start), days);
    const nextEnd = addDays(new Date(current.end), days);
    const override = { start: nextStart.toISOString(), end: nextEnd.toISOString() };
    setTaskOverrides((prev) => ({ ...prev, [taskId]: override }));
    onReschedule?.(taskId, override.start, override.end);
  }

  return (
    <section className="surface" style={{ padding: "1.25rem", overflowX: "auto" }}>
      <header style={{ marginBottom: "1rem" }}>
        <div className="eyebrow">D3 gantt</div>
        <h2 style={{ marginBottom: "0.35rem" }}>Dependency-aware schedule view</h2>
        <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
          Drag-reschedule stays bounded here: adjust one task at a time while dependency arrows remain visible.
        </p>
      </header>

      <GanttTimeline labels={labels} />

      <svg role="img" aria-label="Project gantt chart" width={layout.totalWidth + 160} height={layout.bars.length * 32 + 40}>
        {layout.arrows.map((arrow) => (
          <path key={arrow.id} d={arrow.path} stroke="rgba(15,23,42,0.35)" fill="none" strokeWidth="2" transform="translate(140 24)" />
        ))}
        {layout.bars.map((bar, index) => {
          const task = effectiveTasks[index];
          const startX = scale(new Date(task.start));
          const endX = scale(new Date(task.end));
          const width = Math.max(endX - startX, 32);

          return (
            <g key={bar.taskId} transform={`translate(0 ${24 + index * 32})`}>
              <text x={0} y={16} fill="#0f172a" fontSize="12">
                {task.title}
              </text>
              <rect
                x={140 + startX}
                y={2}
                width={width}
                height={20}
                rx={10}
                fill={task.status === "BLOCKED" ? "rgba(185,28,28,0.78)" : "rgba(15,118,110,0.8)"}
              />
              <text x={150 + startX} y={16} fill="#f8fafc" fontSize="11">
                {task.owner}
              </text>
              <foreignObject x={140 + startX + width + 8} y={0} width={80} height={24}>
                <div style={{ display: "flex", gap: "0.25rem" }}>
                  <button type="button" className="focus-ring" style={{ borderRadius: "999px", border: "1px solid rgba(15,23,42,0.12)", background: "#fff" }} onClick={() => shiftTask(task.id, -1)}>
                    -
                  </button>
                  <button type="button" className="focus-ring" style={{ borderRadius: "999px", border: "1px solid rgba(15,23,42,0.12)", background: "#fff" }} onClick={() => shiftTask(task.id, 1)}>
                    +
                  </button>
                </div>
              </foreignObject>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
