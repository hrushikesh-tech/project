import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { FinanceAccountsController } from './finance-accounts.controller';
import { FinanceEntitiesController } from './finance-entities.controller';
import { FinanceExceptionFilter } from './finance-exception.filter';
import { FinanceFxRatesController } from './finance-fx-rates.controller';
import { FinanceIntercompanyTransfersController } from './finance-intercompany-transfers.controller';
import { FinanceJournalEntriesController } from './finance-journal-entries.controller';
import { FinancePeriodsController } from './finance-periods.controller';
import { FinanceReportsController } from './finance-reports.controller';
import { FinanceService } from './finance.service';
import { FxRatesService } from './fx-rates.service';

@Module({
  controllers: [
    FinanceEntitiesController,
    FinanceAccountsController,
    FinancePeriodsController,
    FinanceJournalEntriesController,
    FinanceFxRatesController,
    FinanceReportsController,
    FinanceIntercompanyTransfersController,
  ],
  providers: [
    FinanceService,
    FxRatesService,
    {
      provide: APP_FILTER,
      useClass: FinanceExceptionFilter,
    },
  ],
  exports: [FinanceService],
})
export class FinanceModule {}
