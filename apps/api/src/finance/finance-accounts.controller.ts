import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { LegalEntityScopeQueryDto } from './dto/finance-query.dto';

@ApiTags('finance')
@Controller({ path: 'finance/accounts', version: '1' })
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
