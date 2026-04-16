import { Body, Controller, Get, Post } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto';

@Controller('api/v1/finance/entities')
export class FinanceEntitiesController {
  constructor(private readonly financeService: FinanceService) {}

  @Get()
  list() {
    return this.financeService.listLegalEntities();
  }

  @Post()
  create(@Body() dto: CreateLegalEntityDto) {
    return this.financeService.createLegalEntity(dto);
  }
}
