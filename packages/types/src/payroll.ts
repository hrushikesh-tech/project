export enum PayrollResultStatus {
  PENDING = "PENDING",
  CALCULATED = "CALCULATED",
  PAYSLIP_GENERATED = "PAYSLIP_GENERATED",
  POSTED = "POSTED",
  FAILED = "FAILED",
}

export enum PayrollRunStage {
  QUEUED = "QUEUED",
  SNAPSHOTTING = "SNAPSHOTTING",
  CALCULATING = "CALCULATING",
  GENERATING_PAYSLIPS = "GENERATING_PAYSLIPS",
  POSTING_LEDGER = "POSTING_LEDGER",
  COMPENSATING = "COMPENSATING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum SalaryComponentType {
  EARNING = "EARNING",
  DEDUCTION = "DEDUCTION",
}

export enum TaxRegime {
  OLD = "OLD",
  NEW = "NEW",
}

export type PayrollBreakdownLine = {
  code: string;
  name: string;
  amountMinor: bigint;
  category?: string;
  metadata?: Record<string, unknown>;
};

export type PayrollInputComponent = PayrollBreakdownLine & {
  componentType: SalaryComponentType;
  isTaxable?: boolean;
  pfApplicable?: boolean;
  professionalTaxApplicable?: boolean;
  overtimeApplicable?: boolean;
};

export type PayrollCalculationInput = {
  tenantId: string;
  employeeId: string;
  salaryStructureId: string;
  legalEntityId: string;
  periodStart: string;
  periodEnd: string;
  currency: string;
  taxRegime: TaxRegime;
  workingDays: number;
  payableDays: number;
  presentDays: number;
  leaveDays: number;
  overtimeHours: number;
  overtimeEligible: boolean;
  earningsComponents: PayrollInputComponent[];
  deductionComponents: PayrollInputComponent[];
};

export type PayrollTaxBreakdown = {
  regime: TaxRegime;
  taxableIncomeMinor: bigint;
  annualTaxMinor: bigint;
  monthlyTaxMinor: bigint;
  rebateMinor: bigint;
  slabBreakdown: PayrollBreakdownLine[];
};

export type PayrollCalculationSnapshot = {
  employeeId: string;
  salaryStructureId: string;
  legalEntityId: string;
  periodStart: string;
  periodEnd: string;
  payableDays: number;
  workingDays: number;
  presentDays: number;
  leaveDays: number;
  overtimeHours: number;
  overtimeAmountMinor: bigint;
  lossOfPayMinor: bigint;
  earnings: PayrollBreakdownLine[];
  deductions: PayrollBreakdownLine[];
  taxBreakdown: PayrollTaxBreakdown;
  grossPayMinor: bigint;
  totalDeductionsMinor: bigint;
  netPayMinor: bigint;
  taxRegime: TaxRegime;
};

export class InvalidPayrollRunScopeException extends Error {
  constructor(
    message = "Payroll run scope is invalid for the selected legal entity and pay period.",
  ) {
    super(message);
    this.name = "InvalidPayrollRunScopeException";
  }
}

export class MissingSalaryStructureException extends Error {
  constructor(
    message = "MissingSalaryStructure: employee compensation profile is required before payroll can run.",
  ) {
    super(message);
    this.name = "MissingSalaryStructureException";
  }
}

export class UnsupportedTaxRegimeException extends Error {
  constructor(
    message = "Unsupported tax regime or missing tax slab configuration for the selected payroll period.",
  ) {
    super(message);
    this.name = "UnsupportedTaxRegimeException";
  }
}

export class PayrollCompensationFailureException extends Error {
  constructor(
    message = "PayrollCompensation: payroll compensation or reversal failed after partial execution.",
  ) {
    super(message);
    this.name = "PayrollCompensationFailureException";
  }
}

export class PayslipGenerationFailureException extends Error {
  constructor(
    message = "PayslipGeneration: payslip rendering or storage failed.",
  ) {
    super(message);
    this.name = "PayslipGenerationFailureException";
  }
}
