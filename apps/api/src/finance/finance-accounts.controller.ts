import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { LegalEntityScopeQueryDto } from './dto/finance-query.dto';

@Controller('api/v1/finance/accounts')
export class FinanceAccountsController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  list(@Query() query: LegalEntityScopeQueryDto) {
    return this.financeService.listAccounts(query.legalEntityId);
  }

  @Post()
  create(@Body() dto: CreateAccountDto) {
    return this.financeService.createAccount(dto);
  }
}
