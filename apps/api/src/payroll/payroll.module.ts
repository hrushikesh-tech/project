import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { FinanceModule } from "../finance/finance.module";
import { PayrollController } from "./payroll.controller";
import { PayrollService } from "./payroll.service";
import { PayrollEngineService } from "./engine/payroll-engine.service";
import { IndiaTaxService } from "./engine/india-tax.service";
import { PAYROLL_RUNS_QUEUE, PayrollQueue } from "./queue/payroll.queue";
import { PayrollProcessor } from "./queue/payroll.processor";
import { PayslipPdfService } from "./pdf/payslip-pdf.service";
import { PayslipStorageService } from "./storage/payslip-storage.service";
import { PayrollLedgerPostingService } from "./posting/payroll-ledger-posting.service";
import { isWorkerRuntime } from "../runtime/runtime-mode";

@Module({
  imports: [
    FinanceModule,
    BullModule.registerQueue({
      name: PAYROLL_RUNS_QUEUE,
    }),
  ],
  controllers: [PayrollController],
  providers: [
    PayrollService,
    PayrollEngineService,
    IndiaTaxService,
    PayrollQueue,
    ...(isWorkerRuntime() ? [PayrollProcessor] : []),
    PayslipPdfService,
    PayslipStorageService,
    PayrollLedgerPostingService,
  ],
  exports: [PayrollService, PayrollEngineService],
})
export class PayrollModule {}
