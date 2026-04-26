import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FxRateQueryDto } from './dto/finance-query.dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@Controller({ path: 'finance/fx-rates', version: '1' })
export class FinanceFxRatesController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  getRate(@Query() query: FxRateQueryDto) {
    return this.financeService.getFxRate(query);
  }
}
