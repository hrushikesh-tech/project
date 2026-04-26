"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import { GanttChart } from "@/components/projects/gantt-chart";
import { ModuleHomeHero } from "@/components/module-home/module-home-hero";
import { getProjectDetail, getProjects, updateProjectTaskDates } from "@/lib/api/client";
import { queryKeys } from "@/lib/query/keys";

import { Button } from "@amdox/ui";

export default function ProjectsPage() {
  const { data: session } = useSession();
  const projects = useQuery({
    queryKey: queryKeys.projects,
    queryFn: () => getProjects({ accessToken: session?.accessToken }),
  });
  const project = projects.data?.[0];
  const projectDetail = useQuery({
    queryKey: queryKeys.projectDetail(project?.id ?? "project-1"),
    queryFn: () => getProjectDetail(project?.id ?? "project-1", { accessToken: session?.accessToken }),
    enabled: Boolean(project?.id),
  });

  return (
    <section className="page-stack">
      <ModuleHomeHero
        eyebrow="Projects"
        title="Bounded scheduling with visible dependencies"
        description="The Gantt path is interactive where it matters, but still deliberately bounded so it stays an ERP planning surface instead of turning into a full scheduling engine."
        badge="UI-09 live"
      />

      {project ? (
        <>
          <section className="surface" style={{ padding: "1.25rem", display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <div className="eyebrow">{project.code}</div>
              <h2 style={{ marginBottom: "0.35rem" }}>{project.name}</h2>
              <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
                {project.manager} | {project.status} | {project.budgetLabel}
              </p>
            </div>
            <Link href={`/dashboard/projects/${project.id}`}>
              <Button type="button">Open project gantt</Button>
            </Link>
          </section>
          {projectDetail.data ? (
            <GanttChart
              tasks={projectDetail.data.tasks}
              dependencies={projectDetail.data.dependencies}
              onReschedule={(taskId, start, end) => {
                void updateProjectTaskDates(taskId, start, end);
              }}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}
