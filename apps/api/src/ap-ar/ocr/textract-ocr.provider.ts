import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DetectDocumentTextCommand,
  TextractClient,
} from '@aws-sdk/client-textract';
import {
  InvoiceOcrProvider,
  OcrDocumentInput,
  OcrExtractionResult,
} from './ocr.provider';

@Injectable()
export class TextractOcrProvider implements InvoiceOcrProvider {
  readonly name = 'TEXTRACT';
  private readonly client: TextractClient;
  private readonly enabled: boolean;

  constructor(private readonly configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');
    this.enabled = Boolean(region && accessKeyId && secretAccessKey);

    this.client = new TextractClient({
      region,
      credentials:
        this.enabled && accessKeyId && secretAccessKey
          ? { accessKeyId, secretAccessKey }
          : undefined,
    });
  }

  isAvailable() {
    return this.enabled;
  }

  async extract(input: OcrDocumentInput): Promise<OcrExtractionResult> {
    const response = await this.client.send(
      new DetectDocumentTextCommand({
        Document: {
          Bytes: input.sourceBuffer,
        },
      }),
    );

    const lines =
      response.Blocks?.filter(
        (block): block is NonNullable<typeof block> => block.BlockType === 'LINE' && Boolean(block.Text),
      ).map((block) => block.Text as string) ?? [];
    const joinedText = lines.join('\n');

    return {
      ...extractStructuredHints(joinedText),
      lineItems: [],
      rawPayload: response,
    };
  }
}

function extractStructuredHints(text: string) {
  const invoiceNumber = text.match(/invoice\s*(number|no\.?)[:#\s-]*([A-Z0-9-]+)/i)?.[2] ?? null;
  const poNumber = text.match(/\bpo\s*(number|no\.?)[:#\s-]*([A-Z0-9-]+)/i)?.[2] ?? null;
  const totalRaw = text.match(/\btotal\b[:\s$]*([0-9.,]+)/i)?.[1] ?? null;
  const taxRaw = text.match(/\btax\b[:\s$]*([0-9.,]+)/i)?.[1] ?? null;

  return {
    invoiceNumber,
    poNumber,
    totalAmountMinor: parseCurrencyToMinor(totalRaw),
    taxAmountMinor: parseCurrencyToMinor(taxRaw),
  };
}

function parseCurrencyToMinor(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/,/g, ''));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}
