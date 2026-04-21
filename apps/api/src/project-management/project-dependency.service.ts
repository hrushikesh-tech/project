import { Injectable, NotFoundException } from "@nestjs/common";
import { CircularDependencyException } from "@amdox/types";
import { PrismaService } from "../prisma/prisma.service";

type DependencyRecord = {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  type: string;
  tenantId: string;
};

type TenantPrisma = ReturnType<PrismaService["forTenant"]>;

@Injectable()
export class ProjectDependencyService {
  async createDependency(
    db: TenantPrisma,
    tenantId: string,
    data: { taskId: string; dependsOnTaskId: string; type: string },
  ) {
    if (data.taskId === data.dependsOnTaskId) {
      throw new CircularDependencyException("A task cannot depend on itself.");
    }

    const [task, dependsOnTask] = await Promise.all([
      db.task.findFirst({
        where: { id: data.taskId, tenantId, deletedAt: null },
      }),
      db.task.findFirst({
        where: { id: data.dependsOnTaskId, tenantId, deletedAt: null },
      }),
    ]);

    if (!task || !dependsOnTask) {
      throw new NotFoundException("Task dependency target not found.");
    }

    if (task.projectId !== dependsOnTask.projectId) {
      throw new CircularDependencyException(
        "Task dependencies are only allowed within the same project.",
      );
    }

    const existing = await db.taskDependency.findUnique({
      where: {
        taskId_dependsOnTaskId: {
          taskId: data.taskId,
          dependsOnTaskId: data.dependsOnTaskId,
        },
      },
    });
    if (existing) {
      return existing;
    }

    const dependencies = await db.taskDependency.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: [{ createdAt: "asc" }],
    });

    if (
      this.wouldCreateCycle(dependencies, data.taskId, data.dependsOnTaskId)
    ) {
      throw new CircularDependencyException();
    }

    return db.taskDependency.create({
      data: {
        tenantId,
        taskId: data.taskId,
        dependsOnTaskId: data.dependsOnTaskId,
        type: data.type,
      },
      include: {
        task: true,
        dependsOn: true,
      },
    });
  }

  async deleteDependency(db: TenantPrisma, id: string, tenantId: string) {
    const dependency = await db.taskDependency.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!dependency) {
      throw new NotFoundException("Task dependency not found.");
    }
    return db.taskDependency.delete({ where: { id } });
  }

  private wouldCreateCycle(
    dependencies: DependencyRecord[],
    taskId: string,
    dependsOnTaskId: string,
  ) {
    const adjacency = new Map<string, string[]>();

    for (const dependency of dependencies) {
      const edges = adjacency.get(dependency.taskId) ?? [];
      edges.push(dependency.dependsOnTaskId);
      adjacency.set(dependency.taskId, edges);
    }

    const nextEdges = adjacency.get(taskId) ?? [];
    nextEdges.push(dependsOnTaskId);
    adjacency.set(taskId, nextEdges);

    const visited = new Set<string>();
    const stack = new Set<string>();

    const visit = (node: string): boolean => {
      if (stack.has(node)) {
        return true;
      }
      if (visited.has(node)) {
        return false;
      }

      visited.add(node);
      stack.add(node);
      for (const neighbor of adjacency.get(node) ?? []) {
        if (visit(neighbor)) {
          return true;
        }
      }
      stack.delete(node);
      return false;
    };

    return visit(taskId);
  }
}
