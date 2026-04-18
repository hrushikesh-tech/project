import { Injectable, NotFoundException } from "@nestjs/common";
import { AccountType } from "@amdox/db";
import { FinanceService } from "../../finance/finance.service";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PayrollLedgerPostingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly financeService: FinanceService,
  ) {}

  async postRun(tenantId: string, payrollRunId: string) {
    const db = this.prisma.forTenant(tenantId);
    const run = await db.payrollRun.findFirst({
      where: { id: payrollRunId, deletedAt: null },
    });
    if (!run) {
      throw new NotFoundException("Payroll run not found.");
    }
    if (run.glJournalEntryId) {
      return { id: run.glJournalEntryId };
    }

    const results = await db.payrollResult.findMany({
      where: { payrollRunId, deletedAt: null },
      orderBy: [{ createdAt: "asc" }],
    });
    if (results.length === 0) {
      throw new NotFoundException("Payroll results not found.");
    }

    const accounts = await db.account.findMany({
      where: {
        legalEntityId: run.legalEntityId,
        deletedAt: null,
        type: { in: [AccountType.EXPENSE, AccountType.LIABILITY] },
      },
      orderBy: [{ code: "asc" }],
    });

    const expenseAccount = accounts.find(
      (account) => account.type === AccountType.EXPENSE,
    );
    const liabilityAccounts = accounts.filter(
      (account) => account.type === AccountType.LIABILITY,
    );
    const payableAccount = liabilityAccounts[0];
    const statutoryAccount = liabilityAccounts[1] ?? payableAccount;

    if (!expenseAccount || !payableAccount) {
      throw new NotFoundException(
        "Payroll posting accounts are not configured.",
      );
    }

    const grossMinor = results.reduce(
      (sum, result) => sum + result.grossPay,
      0n,
    );
    const deductionsMinor = results.reduce(
      (sum, result) => sum + result.totalDeductions,
      0n,
    );
    const netMinor = results.reduce((sum, result) => sum + result.netPay, 0n);
    const fiscalPeriodId = String(
      (results[0].inputSnapshot as { fiscalPeriodId?: string })
        ?.fiscalPeriodId ?? "",
    );
    if (!fiscalPeriodId) {
      throw new NotFoundException("Payroll fiscal period mapping not found.");
    }

    const entry = await this.financeService.createAndPostJournalEntryForTenant(
      tenantId,
      {
        legalEntityId: run.legalEntityId,
        periodId: fiscalPeriodId,
        date: run.periodEnd.toISOString(),
        description: `Payroll run ${run.period}`,
        lines: [
          {
            accountId: expenseAccount.id,
            debitAmountMinor: Number(grossMinor),
            currency: "INR",
            description: "Payroll expense",
          },
          {
            accountId: payableAccount.id,
            creditAmountMinor: Number(netMinor),
            currency: "INR",
            description: "Payroll payable",
          },
          ...(deductionsMinor > 0n
            ? [
                {
                  accountId: statutoryAccount.id,
                  creditAmountMinor: Number(deductionsMinor),
                  currency: "INR",
                  description: "Payroll deductions payable",
                },
              ]
            : []),
        ],
      },
      "payroll-worker",
    );

    await db.payrollRun.update({
      where: { id: payrollRunId },
      data: { glJournalEntryId: entry.id },
    });

    return entry;
  }

  async reverseRunPosting(
    tenantId: string,
    payrollRunId: string,
    reason: string,
  ) {
    const db = this.prisma.forTenant(tenantId);
    const run = await db.payrollRun.findFirst({
      where: { id: payrollRunId, deletedAt: null },
    });
    if (!run?.glJournalEntryId) {
      return null;
    }

    const reversal = await this.financeService.reverseJournalEntryForTenant(
      tenantId,
      run.glJournalEntryId,
      {
        description: reason,
        reversalDate: new Date().toISOString(),
      },
      "payroll-worker",
    );

    await db.payrollRun.update({
      where: { id: payrollRunId },
      data: {
        compensationJournalEntryId: reversal.id,
      },
    });

    return reversal;
  }
}
