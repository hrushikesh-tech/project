import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateFiscalPeriodDto } from './dto/create-fiscal-period.dto';
import { LegalEntityScopeQueryDto } from './dto/finance-query.dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@Controller({ path: 'finance/periods', version: '1' })
export class FinancePeriodsController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  list(@Query() query: LegalEntityScopeQueryDto) {
    return this.financeService.listFiscalPeriods(query.legalEntityId);
  }

  @Post()
  create(@Body() dto: CreateFiscalPeriodDto) {
    return this.financeService.createFiscalPeriod(dto);
  }

  @Post(':id/close')
  close(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.financeService.closeFiscalPeriod(id, user?.userId);
  }
}
