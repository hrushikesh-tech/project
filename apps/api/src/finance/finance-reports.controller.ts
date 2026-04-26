import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReportQueryDto } from './dto/finance-query.dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@Controller({ path: 'finance/reports', version: '1' })
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
