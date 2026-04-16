import { Controller, Get, Query } from '@nestjs/common';
import { ReportQueryDto } from './dto/finance-query.dto';
import { FinanceService } from './finance.service';

@Controller('api/v1/finance/reports')
export class FinanceReportsController {
  constructor(private readonly financeService: FinanceService) {}

  @Get('trial-balance')
  trialBalance(@Query() query: ReportQueryDto) {
    return this.financeService.getTrialBalance(query);
  }

  @Get('balance-sheet')
  balanceSheet(@Query() query: ReportQueryDto) {
    return this.financeService.getBalanceSheet(query);
  }

  @Get('income-statement')
  incomeStatement(@Query() query: ReportQueryDto) {
    return this.financeService.getIncomeStatement(query);
  }
}
