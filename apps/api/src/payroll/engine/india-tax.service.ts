import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import {
  PayrollBreakdownLine,
  PayrollTaxBreakdown,
  TaxRegime,
  UnsupportedTaxRegimeException,
} from "@amdox/types";

const MINOR_UNIT_FACTOR = 100n;
const ANNUAL_MONTHS = 12n;
const STANDARD_DEDUCTION_MINOR = 50000n * MINOR_UNIT_FACTOR;
const HEALTH_AND_EDUCATION_CESS_PERCENT = 4;

type AnnualTaxComputation = {
  taxableIncomeMinor: bigint;
  annualTaxMinor: bigint;
  monthlyTaxMinor: bigint;
  rebateMinor: bigint;
  slabBreakdown: PayrollBreakdownLine[];
};

@Injectable()
export class IndiaTaxService {
  constructor(private readonly prisma: PrismaService) {}

  async calculateMonthlyTax(params: {
    tenantId: string;
    taxRegime: TaxRegime;
    monthlyEarningsMinor: bigint;
    pretaxDeductionsMinor: bigint;
    periodEnd: Date;
  }): Promise<AnnualTaxComputation> {
    const annualizedGrossMinor = params.monthlyEarningsMinor * ANNUAL_MONTHS;
    const annualizedPretaxMinor = params.pretaxDeductionsMinor * ANNUAL_MONTHS;
    const taxableIncomeMinor = this.nonNegative(
      annualizedGrossMinor - annualizedPretaxMinor - STANDARD_DEDUCTION_MINOR,
    );

    const slabs = await this.prisma.tenant.taxSlab.findMany({
      where: {
        deletedAt: null,
        jurisdiction: "IN",
        regime: params.taxRegime,
        effectiveFrom: { lte: params.periodEnd },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: params.periodEnd } }],
      },
      orderBy: [{ minIncome: "asc" }],
    });

    if (slabs.length === 0) {
      throw new UnsupportedTaxRegimeException();
    }

    let annualTaxMinor = 0n;
    const slabBreakdown: PayrollBreakdownLine[] = [];

    for (const slab of slabs) {
      const slabMinMinor = BigInt(slab.minIncome.toString());
      const slabMaxMinor =
        slab.maxIncome == null ? null : BigInt(slab.maxIncome.toString());

      if (taxableIncomeMinor <= slabMinMinor) {
        continue;
      }

      const taxablePortionMinor =
        slabMaxMinor == null
          ? taxableIncomeMinor - slabMinMinor
          : this.nonNegative(
              this.minBigInt(taxableIncomeMinor, slabMaxMinor) - slabMinMinor,
            );

      if (taxablePortionMinor <= 0n) {
        continue;
      }

      const slabTaxMinor = this.multiplyByRate(
        taxablePortionMinor,
        Number(slab.rate.toString()),
      );
      annualTaxMinor += slabTaxMinor;
      slabBreakdown.push({
        code: `IN-${params.taxRegime}-${slab.minIncome.toString()}`,
        name: `${params.taxRegime} slab ${slab.minIncome.toString()}`,
        amountMinor: slabTaxMinor,
        category: "TAX",
        metadata: {
          minIncomeMinor: slabMinMinor.toString(),
          maxIncomeMinor: slabMaxMinor?.toString() ?? null,
          rate: slab.rate.toString(),
        },
      });
    }

    const rebateLimit = slabs.reduce<bigint | null>((current, slab) => {
      if (slab.rebateLimit == null) {
        return current;
      }
      const value = BigInt(slab.rebateLimit.toString());
      return current == null || value > current ? value : current;
    }, null);

    const rebateMinor =
      rebateLimit != null && taxableIncomeMinor <= rebateLimit
        ? annualTaxMinor
        : 0n;
    const netAnnualTaxMinor = this.nonNegative(annualTaxMinor - rebateMinor);
    const cessMinor = this.multiplyByRate(
      netAnnualTaxMinor,
      HEALTH_AND_EDUCATION_CESS_PERCENT,
    );
    const totalAnnualTaxMinor = netAnnualTaxMinor + cessMinor;

    if (cessMinor > 0n) {
      slabBreakdown.push({
        code: "HEALTH_EDUCATION_CESS",
        name: "Health and education cess",
        amountMinor: cessMinor,
        category: "TAX",
        metadata: {
          rate: `${HEALTH_AND_EDUCATION_CESS_PERCENT}`,
        },
      });
    }

    return {
      taxableIncomeMinor,
      annualTaxMinor: totalAnnualTaxMinor,
      monthlyTaxMinor: this.roundDivide(totalAnnualTaxMinor, ANNUAL_MONTHS),
      rebateMinor,
      slabBreakdown,
    };
  }

  toTaxBreakdown(params: {
    taxRegime: TaxRegime;
    tax: AnnualTaxComputation;
  }): PayrollTaxBreakdown {
    return {
      regime: params.taxRegime,
      taxableIncomeMinor: params.tax.taxableIncomeMinor,
      annualTaxMinor: params.tax.annualTaxMinor,
      monthlyTaxMinor: params.tax.monthlyTaxMinor,
      rebateMinor: params.tax.rebateMinor,
      slabBreakdown: params.tax.slabBreakdown,
    };
  }

  private multiplyByRate(amountMinor: bigint, ratePercent: number) {
    if (amountMinor === 0n || ratePercent === 0) {
      return 0n;
    }
    const basisPoints = BigInt(Math.round(ratePercent * 100));
    return (amountMinor * basisPoints + 5000n) / 10000n;
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

  private minBigInt(left: bigint, right: bigint) {
    return left < right ? left : right;
  }
}
