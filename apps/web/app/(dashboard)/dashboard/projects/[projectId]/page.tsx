"use client";

import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { GanttChart } from "@/components/projects/gantt-chart";
import { getProjectDetail, updateProjectTaskDates } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

export default function ProjectDetailPage({
  params,
}: {
  params: { projectId: string };
}) {
  const { data: session } = useSession();
  const projectDetail = useQuery({
    queryKey: queryKeys.projectDetail(params.projectId),
    queryFn: () => getProjectDetail(params.projectId, { accessToken: session?.accessToken }),
  });

  if (!projectDetail.data) {
    return <section className="surface" style={{ padding: "1.25rem" }}>Loading project schedule...</section>;
  }

  return (
    <GanttChart
      tasks={projectDetail.data.tasks}
      dependencies={projectDetail.data.dependencies}
      onReschedule={(taskId, start, end) => {
        void updateProjectTaskDates(taskId, start, end);
      }}
    />
  );
}
