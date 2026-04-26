import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags } from '@nestjs/swagger';
import { ApArService } from './ap-ar.service';
import { AgingReportQueryDto } from './dto/aging-report-query.dto';
import { ReviewInvoiceDto } from './dto/review-invoice.dto';
import type { UploadedInvoiceFile } from './ap-ar.service';
import { UploadInvoiceDto } from './dto/upload-invoice.dto';
import { RateLimit } from '../common/security/rate-limit.decorator';
import { RATE_LIMIT_BUCKETS } from '../common/security/rate-limit.policy';
import { EntityIdPipe } from '../common/validation/entity-id.pipe';

@ApiTags('ap-ar')
@Controller({ path: 'ap-ar', version: '1' })
export class ApArController {
  constructor(private readonly apArService: ApArService) {}

  @Post('invoices/upload')
  @RateLimit(RATE_LIMIT_BUCKETS.OCR)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
    }),
  )
  uploadInvoice(
    @Body() dto: UploadInvoiceDto,
    @UploadedFile() file: UploadedInvoiceFile,
  ) {
    return this.apArService.uploadInvoice(dto, file);
  }

  @Get('invoices/:id')
  getInvoice(@Param('id', EntityIdPipe) id: string) {
    return this.apArService.getInvoice(id);
  }

  @Post('invoices/:id/match')
  matchInvoice(@Param('id', EntityIdPipe) id: string) {
    return this.apArService.matchInvoice(id);
  }

  @Post('invoices/:id/review')
  reviewInvoice(@Param('id', EntityIdPipe) id: string, @Body() dto: ReviewInvoiceDto) {
    return this.apArService.reviewInvoice(id, dto);
  }

  @Get('reports/aging')
  getAgingReport(@Query() query: AgingReportQueryDto) {
    return this.apArService.getAgingReport(query);
  }
}
