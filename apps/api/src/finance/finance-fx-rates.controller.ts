import { Controller, Get, Query } from '@nestjs/common';
import { FxRateQueryDto } from './dto/finance-query.dto';
import { FinanceService } from './finance.service';

@Controller('api/v1/finance/fx-rates')
export class FinanceFxRatesController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  getRate(@Query() query: FxRateQueryDto) {
    return this.financeService.getFxRate(query);
  }
}
