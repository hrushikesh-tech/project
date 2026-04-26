import { TaskStatus } from "@amdox/types";
import type { ProjectDependencyRecord, ProjectTaskRecord } from "@/lib/api/client";

export type GanttBar = {
  taskId: string;
  title: string;
  x: number;
  y: number;
  width: number;
  status: string;
};

export type GanttArrow = {
  id: string;
  path: string;
};

export type GanttLayoutResult = {
  bars: GanttBar[];
  arrows: GanttArrow[];
  totalWidth: number;
};

function differenceInDays(start: Date, end: Date) {
  return Math.max(Math.round((end.getTime() - start.getTime()) / 86_400_000), 1);
}

export function buildGanttLayout(
  tasks: ProjectTaskRecord[],
  dependencies: ProjectDependencyRecord[],
  dayWidth = 24,
  rowHeight = 28,
): GanttLayoutResult {
  if (!tasks.length) {
    return { bars: [], arrows: [], totalWidth: 0 };
  }

  const starts = tasks.map((task) => new Date(task.start));
  const ends = tasks.map((task) => new Date(task.end));
  const minStart = new Date(Math.min(...starts.map((value) => value.getTime())));
  const maxEnd = new Date(Math.max(...ends.map((value) => value.getTime())));

  const bars = tasks.map((task, index) => {
    const start = new Date(task.start);
    const end = new Date(task.end);
    const x = differenceInDays(minStart, start) * dayWidth;
    const width = differenceInDays(start, end) * dayWidth;
    const y = index * rowHeight;

    return {
      taskId: task.id,
      title: task.title,
      x,
      y,
      width,
      status: task.status,
    };
  });

  const barMap = new Map(bars.map((bar) => [bar.taskId, bar]));
  const arrows = dependencies
    .map((dependency) => {
      const predecessor = barMap.get(dependency.predecessorId);
      const successor = barMap.get(dependency.successorId);

      if (!predecessor || !successor) {
        return null;
      }

      const startX = predecessor.x + predecessor.width;
      const startY = predecessor.y + rowHeight / 2;
      const endX = successor.x;
      const endY = successor.y + rowHeight / 2;
      const midX = startX + 14;

      return {
        id: dependency.id,
        path: `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`,
      };
    })
    .filter((arrow): arrow is GanttArrow => Boolean(arrow));

  return {
    bars,
    arrows,
    totalWidth: differenceInDays(minStart, maxEnd) * dayWidth + 180,
  };
}

export function buildLargeTaskFixture(total = 500): ProjectTaskRecord[] {
  return Array.from({ length: total }, (_, index) => {
    const start = new Date(2026, 0, 1 + index);
    const end = new Date(start);
    end.setDate(start.getDate() + 2 + (index % 6));

    return {
      id: `fixture-task-${index + 1}`,
      projectId: "fixture-project",
      title: `Fixture task ${index + 1}`,
      start: start.toISOString(),
      end: end.toISOString(),
      status: index % 4 === 0 ? TaskStatus.IN_PROGRESS : TaskStatus.TODO,
      owner: "Fixture Owner",
    };
  });
}
