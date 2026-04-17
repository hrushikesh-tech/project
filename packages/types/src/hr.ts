export class EmployeeLifecycleException extends Error {
  constructor(
    message = "Employee lifecycle change is invalid for the current employment state.",
  ) {
    super(message);
    this.name = "EmployeeLifecycleException";
  }
}

export class DepartmentHeadValidationException extends Error {
  constructor(
    message = "Department head must belong to the same department and tenant as the assignment target.",
  ) {
    super(message);
    this.name = "DepartmentHeadValidationException";
  }
}

export class InvalidLeaveTransitionException extends Error {
  constructor(
    message = "Leave request transition is invalid for the current workflow state.",
  ) {
    super(message);
    this.name = "InvalidLeaveTransitionException";
  }
}

export class InsufficientLeaveBalanceException extends Error {
  constructor(
    message = "Leave request cannot be approved because the available leave balance is insufficient.",
  ) {
    super(message);
    this.name = "InsufficientLeaveBalanceException";
  }
}

export class AttendanceCorrectionException extends Error {
  constructor(
    message = "Attendance correction is invalid without auditable correction details.",
  ) {
    super(message);
    this.name = "AttendanceCorrectionException";
  }
}
