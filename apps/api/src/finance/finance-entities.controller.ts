import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FinanceService } from './finance.service';
import { CreateLegalEntityDto } from './dto/create-legal-entity.dto';

@ApiTags('finance')
@Controller({ path: 'finance/entities', version: '1' })
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
