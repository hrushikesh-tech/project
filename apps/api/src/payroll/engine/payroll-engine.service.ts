import { Injectable } from "@nestjs/common";
import {
  MissingSalaryStructureException,
  PayrollBreakdownLine,
  PayrollCalculationInput,
  PayrollCalculationSnapshot,
  SalaryComponentType,
  TaxRegime,
} from "@amdox/types";
import { IndiaTaxService } from "./india-tax.service";

const HOURS_PER_DAY = 8;
const PROFESSIONAL_TAX_THRESHOLD_MINOR = 15000n * 100n;
const PROFESSIONAL_TAX_MINOR = 200n * 100n;

@Injectable()
export class PayrollEngineService {
  constructor(private readonly indiaTaxService: IndiaTaxService) {}

  async calculate(
    input: PayrollCalculationInput,
  ): Promise<PayrollCalculationSnapshot> {
    if (input.earningsComponents.length === 0) {
      throw new MissingSalaryStructureException();
    }

    const workingDays = Math.max(input.workingDays, 1);
    const payableRatio = Math.max(
      Math.min(input.payableDays / workingDays, 1),
      0,
    );

    const scheduledGrossMinor = input.earningsComponents.reduce(
      (sum, component) => sum + component.amountMinor,
      0n,
    );

    const earnings = input.earningsComponents.map((component) => ({
      code: component.code,
      name: component.name,
      amountMinor: this.roundMultiply(component.amountMinor, payableRatio),
      category: component.componentType,
      metadata: {
        componentType: component.componentType,
        isTaxable: component.isTaxable ?? true,
      },
    }));

    const baseGrossMinor = earnings.reduce(
      (sum, component) => sum + component.amountMinor,
      0n,
    );

    const hourlyRateMinor = this.roundDivide(
      baseGrossMinor,
      BigInt(workingDays * HOURS_PER_DAY),
    );
    const overtimeAmountMinor = input.overtimeEligible
      ? this.roundMultiply(hourlyRateMinor, input.overtimeHours)
      : 0n;
    const lossOfPayMinor = this.nonNegative(
      scheduledGrossMinor - baseGrossMinor,
    );

    if (overtimeAmountMinor > 0n) {
      earnings.push({
        code: "OVERTIME",
        name: "Overtime",
        amountMinor: overtimeAmountMinor,
        category: SalaryComponentType.EARNING,
        metadata: {
          overtimeHours: input.overtimeHours,
        },
      });
    }

    const recurringDeductions = input.deductionComponents.map((component) => ({
      code: component.code,
      name: component.name,
      amountMinor: this.roundMultiply(component.amountMinor, payableRatio),
      category: component.componentType,
      metadata: {
        componentType: component.componentType,
      },
    }));

    const pfBaseMinor = input.earningsComponents
      .filter((component) => component.pfApplicable)
      .reduce(
        (sum, component) =>
          sum + this.roundMultiply(component.amountMinor, payableRatio),
        0n,
      );
    const pfMinor = this.roundMultiply(pfBaseMinor, 0.12);

    const professionalTaxMinor =
      baseGrossMinor >= PROFESSIONAL_TAX_THRESHOLD_MINOR
        ? PROFESSIONAL_TAX_MINOR
        : 0n;

    const pretaxDeductionsMinor =
      recurringDeductions.reduce(
        (sum, component) => sum + component.amountMinor,
        0n,
      ) + pfMinor;

    const taxableEarningsMinor = earnings
      .filter((component) => component.metadata?.isTaxable !== false)
      .reduce((sum, component) => sum + component.amountMinor, 0n);

    const annualTax = await this.indiaTaxService.calculateMonthlyTax({
      tenantId: input.tenantId,
      taxRegime: input.taxRegime as TaxRegime,
      monthlyEarningsMinor: taxableEarningsMinor,
      pretaxDeductionsMinor,
      periodEnd: new Date(input.periodEnd),
    });

    const taxBreakdown = this.indiaTaxService.toTaxBreakdown({
      taxRegime: input.taxRegime as TaxRegime,
      tax: annualTax,
    });

    const deductions: PayrollBreakdownLine[] = [
      ...recurringDeductions,
      {
        code: "PF",
        name: "PF 12%",
        amountMinor: pfMinor,
        category: SalaryComponentType.DEDUCTION,
      },
      {
        code: "PROFESSIONAL_TAX",
        name: "Professional tax",
        amountMinor: professionalTaxMinor,
        category: SalaryComponentType.DEDUCTION,
      },
      {
        code: "INCOME_TAX",
        name: `Income tax (${input.taxRegime})`,
        amountMinor: taxBreakdown.monthlyTaxMinor,
        category: SalaryComponentType.DEDUCTION,
        metadata: {
          section87A: "87A",
        },
      },
    ].filter((item) => item.amountMinor > 0n);

    const grossPayMinor = earnings.reduce(
      (sum, component) => sum + component.amountMinor,
      0n,
    );
    const totalDeductionsMinor = deductions.reduce(
      (sum, component) => sum + component.amountMinor,
      0n,
    );

    return {
      employeeId: input.employeeId,
      salaryStructureId: input.salaryStructureId,
      legalEntityId: input.legalEntityId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      payableDays: input.payableDays,
      workingDays,
      presentDays: input.presentDays,
      leaveDays: input.leaveDays,
      overtimeHours: input.overtimeHours,
      overtimeAmountMinor,
      lossOfPayMinor,
      earnings,
      deductions,
      taxBreakdown,
      grossPayMinor,
      totalDeductionsMinor,
      netPayMinor: grossPayMinor - totalDeductionsMinor,
      taxRegime: input.taxRegime,
    };
  }

  private roundMultiply(amountMinor: bigint, multiplier: number) {
    return BigInt(Math.round(Number(amountMinor) * multiplier));
  }

  private roundDivide(value: bigint, divisor: bigint) {
    if (divisor === 0n) {
      return 0n;
    }
    return (value + divisor / 2n) / divisor;
  }

  private nonNegative(value: bigint) {
    return value < 0n ? 0n : value;
  }
}
