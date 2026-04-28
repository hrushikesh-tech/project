import { Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import {
  PayrollRunStatus,
  PayrollResultStatus,
  PayrollCalculationInput,
} from "@amdox/types";
import { Job } from "bullmq";
import { PrismaService } from "../../prisma/prisma.service";
import { PayrollEngineService } from "../engine/payroll-engine.service";
import { PayslipPdfService } from "../pdf/payslip-pdf.service";
import { PayrollLedgerPostingService } from "../posting/payroll-ledger-posting.service";
import { PayslipStorageService } from "../storage/payslip-storage.service";
import { PAYROLL_RUNS_QUEUE, PayrollRunJobPayload } from "./payroll.queue";
import { recordPayrollRunDuration } from "../../telemetry/metrics";

const BATCH_SIZE = 100;

@Injectable()
@Processor(PAYROLL_RUNS_QUEUE)
export class PayrollProcessor extends WorkerHost {
  private readonly logger = new Logger(PayrollProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payrollEngine: PayrollEngineService,
    private readonly payslipPdfService: PayslipPdfService,
    private readonly payslipStorageService: PayslipStorageService,
    private readonly payrollLedgerPostingService: PayrollLedgerPostingService,
  ) {
    super();
  }

  async process(job: Job<PayrollRunJobPayload>) {
    const { tenantId, payrollRunId } = job.data;
    const db = this.prisma.forTenant(tenantId);
    const run = await db.payrollRun.findFirst({
      where: { id: payrollRunId, deletedAt: null },
    });
    if (!run) {
      throw new Error("Payroll run not found.");
    }
    if (run.status === PayrollRunStatus.COMPLETED) {
      return { skipped: true, payrollRunId };
    }

    let glPosted = Boolean(run.glJournalEntryId);
    const runStartedAt = run.startedAt ?? new Date();

    try {
      await db.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: PayrollRunStatus.PROCESSING,
          processingStage: "CALCULATING",
          startedAt: run.startedAt ?? new Date(),
          failureReason: null,
        },
      });

      const totals = await this.calculateResults(tenantId, payrollRunId);
      await db.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          processingStage: "GENERATING_PAYSLIPS",
          totalGross: totals.gross,
          totalDeductions: totals.deductions,
          totalNet: totals.net,
          processedCount: totals.count,
        },
      });

      await this.generatePayslips(tenantId, payrollRunId);
      await db.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          processingStage: "POSTING_LEDGER",
        },
      });

      const journalEntry = await this.payrollLedgerPostingService.postRun(
        tenantId,
        payrollRunId,
      );
      glPosted = true;

      await db.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: PayrollRunStatus.COMPLETED,
          processingStage: "COMPLETED",
          glJournalEntryId: journalEntry.id,
          completedAt: new Date(),
        },
      });
      await this.persistOperationalEvent({
        tenantId,
        payrollRunId,
        status: "completed",
        message: "Payroll run completed successfully.",
      });
      recordPayrollRunDuration({
        tenantId,
        route: "payroll.processor",
        outcome: "completed",
        durationSeconds: this.calculateDurationSeconds(
          runStartedAt,
          new Date(),
        ),
      });

      return { payrollRunId, journalEntryId: journalEntry.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Payroll run ${payrollRunId} failed: ${message}`);

      const reversal = glPosted
        ? await this.payrollLedgerPostingService.reverseRunPosting(
            tenantId,
            payrollRunId,
            `Payroll compensation after failure: ${message}`,
          )
        : null;

      await db.payrollRun.update({
        where: { id: payrollRunId },
        data: {
          status: PayrollRunStatus.FAILED,
          processingStage: "FAILED",
          failureReason: message,
          compensationJournalEntryId: reversal?.id ?? undefined,
        },
      });
      await this.persistOperationalEvent({
        tenantId,
        payrollRunId,
        status: "failed",
        message,
      });
      recordPayrollRunDuration({
        tenantId,
        route: "payroll.processor",
        outcome: "failed",
        durationSeconds: this.calculateDurationSeconds(
          runStartedAt,
          new Date(),
        ),
      });
      throw error;
    }
  }

  private async calculateResults(tenantId: string, payrollRunId: string) {
    const db = this.prisma.forTenant(tenantId);
    const results = await db.payrollResult.findMany({
      where: {
        payrollRunId,
        deletedAt: null,
      },
      orderBy: [{ createdAt: "asc" }],
    });

    let gross = 0n;
    let deductions = 0n;
    let net = 0n;
    let count = 0;

    for (let index = 0; index < results.length; index += BATCH_SIZE) {
      const batch = results.slice(index, index + BATCH_SIZE);
      for (const result of batch) {
        if (
          result.processingStage === PayrollResultStatus.POSTED ||
          result.processingStage === PayrollResultStatus.PAYSLIP_GENERATED
        ) {
          gross += result.grossPay;
          deductions += result.totalDeductions;
          net += result.netPay;
          count += 1;
          continue;
        }

        const snapshot =
          result.inputSnapshot as unknown as PayrollCalculationInput;
        const calculated = await this.payrollEngine.calculate(snapshot);
        const updated = await db.payrollResult.update({
          where: { id: result.id },
          data: {
            grossPay: calculated.grossPayMinor,
            totalDeductions: calculated.totalDeductionsMinor,
            netPay: calculated.netPayMinor,
            earnings: calculated.earnings,
            deductions: calculated.deductions,
            taxBreakdown: calculated.taxBreakdown,
            lossOfPay: calculated.lossOfPayMinor,
            overtime: calculated.overtimeAmountMinor,
            overtimeHours: calculated.overtimeHours,
            payableDays: calculated.payableDays,
            workingDays: calculated.workingDays,
            presentDays: calculated.presentDays,
            leaveDays: calculated.leaveDays,
            status: PayrollResultStatus.CALCULATED,
            processingStage: PayrollResultStatus.CALCULATED,
            processedAt: new Date(),
          },
        });

        gross += updated.grossPay;
        deductions += updated.totalDeductions;
        net += updated.netPay;
        count += 1;
      }
    }

    return { gross, deductions, net, count };
  }

  private async generatePayslips(tenantId: string, payrollRunId: string) {
    const db = this.prisma.forTenant(tenantId);
    const run = await db.payrollRun.findFirst({
      where: { id: payrollRunId, deletedAt: null },
    });
    const results = await db.payrollResult.findMany({
      where: {
        payrollRunId,
        deletedAt: null,
      },
      include: {
        employee: true,
        payslip: true,
      },
      orderBy: [{ createdAt: "asc" }],
    });

    for (const result of results) {
      if (result.payslip?.storageKey) {
        continue;
      }

      const buffer = await this.payslipPdfService.renderPayslip({
        employeeName:
          `${result.employee.firstName} ${result.employee.lastName}`.trim(),
        period: run.period,
        grossPayMinor: result.grossPay,
        netPayMinor: result.netPay,
        earnings: result.earnings,
        deductions: result.deductions,
        taxBreakdown: result.taxBreakdown,
      });
      const stored = await this.payslipStorageService.uploadPayslip({
        tenantId,
        payrollRunId,
        employeeId: result.employeeId,
        body: buffer,
      });

      if (result.payslip) {
        await db.payslip.update({
          where: { id: result.payslip.id },
          data: {
            pdfUrl: stored.key,
            storageBucket: stored.bucket,
            storageKey: stored.key,
            fileName: stored.fileName,
            contentType: stored.contentType,
            earnings: result.earnings,
            deductions: result.deductions,
            taxBreakdown: result.taxBreakdown,
            renderedAt: new Date(),
          },
        });
      } else {
        await db.payslip.create({
          data: {
            tenantId,
            payrollRunId,
            payrollResultId: result.id,
            employeeId: result.employeeId,
            grossPay: result.grossPay,
            earnings: result.earnings,
            deductions: result.deductions,
            netPay: result.netPay,
            taxBreakdown: result.taxBreakdown,
            pdfUrl: stored.key,
            storageBucket: stored.bucket,
            storageKey: stored.key,
            fileName: stored.fileName,
            contentType: stored.contentType,
            renderedAt: new Date(),
          },
        });
      }

      await db.payrollResult.update({
        where: { id: result.id },
        data: {
          status: PayrollResultStatus.PAYSLIP_GENERATED,
          processingStage: PayrollResultStatus.PAYSLIP_GENERATED,
        },
      });
    }
  }

  private async persistOperationalEvent(params: {
    tenantId: string;
    payrollRunId: string;
    status: "completed" | "failed";
    message: string;
  }) {
    const db = this.prisma.forTenant(params.tenantId);
    await db.outboxEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType:
          params.status === "completed"
            ? "payroll.run.completed"
            : "payroll.run.failed",
        payload: {
          payrollRunId: params.payrollRunId,
          message: params.message,
        },
      },
    });
    await db.notification.create({
      data: {
        tenantId: params.tenantId,
        userId: "payroll-admin",
        type:
          params.status === "completed"
            ? "payroll.run.completed"
            : "payroll.run.failed",
        channel: "IN_APP",
        title:
          params.status === "completed"
            ? "Payroll completed"
            : "Payroll failed",
        body: params.message,
        metadata: {
          payrollRunId: params.payrollRunId,
        },
      },
    });
  }

  private calculateDurationSeconds(startedAt: Date, endedAt: Date) {
    return Math.max((endedAt.getTime() - startedAt.getTime()) / 1000, 0);
  }
}
