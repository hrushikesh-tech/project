import { TaskStatus } from "@amdox/types";
import { describe, expect, it } from "vitest";

import { buildGanttLayout, buildLargeTaskFixture } from "@/lib/projects/gantt-layout";

describe("gantt layout", () => {
  it("builds bars and arrows for bounded gantt rendering", () => {
    const result = buildGanttLayout(
      [
        {
          id: "task-1",
          projectId: "project-1",
          title: "Plan",
          start: new Date(2026, 3, 1).toISOString(),
          end: new Date(2026, 3, 4).toISOString(),
          status: TaskStatus.IN_PROGRESS,
          owner: "Asha",
        },
        {
          id: "task-2",
          projectId: "project-1",
          title: "Build",
          start: new Date(2026, 3, 5).toISOString(),
          end: new Date(2026, 3, 10).toISOString(),
          status: TaskStatus.TODO,
          owner: "Noah",
        },
      ],
      [{ id: "dep-1", predecessorId: "task-1", successorId: "task-2" }],
    );

    expect(result.bars).toHaveLength(2);
    expect(result.arrows).toHaveLength(1);
    expect(result.totalWidth).toBeGreaterThan(0);
  });

  it("supports a realistic 500-task fixture path", () => {
    const tasks = buildLargeTaskFixture(500);
    const result = buildGanttLayout(tasks, []);

    expect(tasks).toHaveLength(500);
    expect(result.bars).toHaveLength(500);
  });
});
