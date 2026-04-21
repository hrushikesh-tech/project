export interface ResourceUtilizationRow {
  employeeId: string;
  employeeCode?: string;
  employeeName?: string;
  projectId?: string;
  projectCode?: string;
  allocatedHours: number;
  availableHours: number;
  utilizationPercent: number;
}

export interface ProjectBudgetOverrunEventPayload {
  projectId: string;
  projectCode: string;
  projectName: string;
  managerId: string;
  budget: number;
  actualCost: number;
  thresholdPercent: number;
  recipients: string[];
}

export class CircularDependencyException extends Error {
  constructor(
    message = "Task dependency would create a circular dependency graph.",
  ) {
    super(message);
    this.name = "CircularDependencyException";
  }
}

export class ProjectManagerValidationException extends Error {
  constructor(
    message = "Project manager must be an active employee in the current tenant.",
  ) {
    super(message);
    this.name = "ProjectManagerValidationException";
  }
}

export class MilestoneTaskLinkException extends Error {
  constructor(
    message = "Milestone linkage is invalid for the selected task or project.",
  ) {
    super(message);
    this.name = "MilestoneTaskLinkException";
  }
}
