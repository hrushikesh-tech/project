import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { RequestUser } from '../common/interfaces/request-user.interface';
import { CreateIntercompanyTransferDto } from './dto/create-intercompany-transfer.dto';
import { FinanceService } from './finance.service';

@Controller('api/v1/finance/intercompany-transfers')
export class FinanceIntercompanyTransfersController {
  constructor(private readonly financeService: FinanceService) {}

  @Post()
  create(
    @Body() dto: CreateIntercompanyTransferDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.financeService.createIntercompanyTransfer(dto, user?.userId);
  }
}
