import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import {
  CreateJournalEntryDto,
  ReverseJournalEntryDto,
} from './dto/create-journal-entry.dto';
import { JournalEntryQueryDto } from './dto/finance-query.dto';
import { FinanceService } from './finance.service';

@ApiTags('finance')
@Controller({ path: 'finance/journal-entries', version: '1' })
export class FinanceJournalEntriesController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  list(@Query() query: JournalEntryQueryDto) {
    return this.financeService.listJournalEntries(query);
  }

  @Post()
  create(@Body() dto: CreateJournalEntryDto) {
    return this.financeService.createJournalEntry(dto);
  }

  @Post(':id/post')
  post(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.financeService.postJournalEntry(id, user?.userId);
  }

  @Post(':id/reverse')
  reverse(
    @Param('id') id: string,
    @Body() dto: ReverseJournalEntryDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.financeService.reverseJournalEntry(id, dto, user?.userId);
  }
}
