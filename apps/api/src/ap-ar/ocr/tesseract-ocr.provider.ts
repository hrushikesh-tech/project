import { Injectable } from "@nestjs/common";
import sharp from "sharp";
import Tesseract from "tesseract.js";
import {
  InvoiceOcrProvider,
  OcrDocumentInput,
  OcrExtractionResult,
} from "./ocr.provider";

type PdfJsPage = {
  getViewport: (options: { scale: number }) => {
    width: number;
    height: number;
  };
  render: (options: { canvasContext: unknown; viewport: unknown }) => {
    promise: Promise<unknown>;
  };
};

type PdfJsDocument = {
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
};

type PdfJsModule = {
  getDocument: (options: { data: Uint8Array }) => {
    promise: Promise<PdfJsDocument>;
  };
};

type CanvasModule = {
  createCanvas: (
    width: number,
    height: number,
  ) => {
    getContext: (contextId: "2d") => unknown;
    toBuffer: (mimeType: "image/png") => Buffer;
  };
};

@Injectable()
export class TesseractOcrProvider implements InvoiceOcrProvider {
  readonly name = "TESSERACT";

  isAvailable() {
    return true;
  }

  async extract(input: OcrDocumentInput): Promise<OcrExtractionResult> {
    const normalizedBuffer = await this.normalizeInputBuffer(input);
    const result = await Tesseract.recognize(normalizedBuffer, "eng");
    const text = result.data.text || "";

    return {
      ...extractStructuredHints(text),
      lineItems: [],
      rawPayload: {
        provider: "tesseract.js",
        text,
        confidence: result.data.confidence,
      },
    };
  }

  private async normalizeInputBuffer(input: OcrDocumentInput) {
    if (input.mimeType === "application/pdf") {
      return this.renderPdfFirstPage(input.sourceBuffer);
    }

    return sharp(input.sourceBuffer).grayscale().normalize().png().toBuffer();
  }

  private async renderPdfFirstPage(buffer: Buffer) {
    const pdfjs =
      (await import("pdfjs-dist/legacy/build/pdf.mjs")) as PdfJsModule;
    const canvasModule = (await import("@napi-rs/canvas")) as CanvasModule;
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = canvasModule.createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext("2d");

    await page.render({
      canvasContext: context,
      viewport,
    }).promise;

    return sharp(canvas.toBuffer("image/png"))
      .grayscale()
      .normalize()
      .png()
      .toBuffer();
  }
}

function extractStructuredHints(text: string) {
  const invoiceNumber =
    text.match(/invoice\s*(number|no\.?)[:#\s-]*([A-Z0-9-]+)/i)?.[2] ?? null;
  const poNumber =
    text.match(/\bpo\s*(number|no\.?)[:#\s-]*([A-Z0-9-]+)/i)?.[2] ?? null;
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

  const parsed = Number(value.replace(/,/g, ""));
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed * 100);
}
