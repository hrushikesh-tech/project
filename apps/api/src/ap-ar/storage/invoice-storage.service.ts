import { Readable } from "node:stream";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type WebStreamBody = {
  transformToWebStream: () => ReadableStream;
};

function hasWebStreamTransform(value: unknown): value is WebStreamBody {
  return (
    typeof value === "object" &&
    value !== null &&
    "transformToWebStream" in value &&
    typeof value.transformToWebStream === "function"
  );
}

@Injectable()
export class InvoiceStorageService {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>("AWS_S3_BUCKET", "");
    this.client = new S3Client({
      region: this.configService.get<string>("AWS_REGION"),
      credentials: {
        accessKeyId: this.configService.get<string>("AWS_ACCESS_KEY_ID", ""),
        secretAccessKey: this.configService.get<string>(
          "AWS_SECRET_ACCESS_KEY",
          "",
        ),
      },
    });
  }

  async uploadInvoiceSource(params: {
    tenantId: string;
    invoiceId: string;
    extension: string;
    contentType: string;
    body: Buffer;
  }) {
    const key = `invoices/${params.tenantId}/${params.invoiceId}/source.${params.extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.body,
        ContentType: params.contentType,
      }),
    );

    return {
      bucket: this.bucket,
      key,
    };
  }

  async getInvoiceSourceStream(sourceDocumentKey: string) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: sourceDocumentKey,
      }),
    );

    const body = response.Body;
    if (body instanceof Readable) {
      return body;
    }

    if (hasWebStreamTransform(body)) {
      return Readable.fromWeb(body.transformToWebStream());
    }

    throw new Error(
      `Unable to read invoice source stream for ${sourceDocumentKey}.`,
    );
  }

  async getInvoiceSourceBuffer(sourceDocumentKey: string) {
    const stream = await this.getInvoiceSourceStream(sourceDocumentKey);
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async deleteInvoiceSource(sourceDocumentKey: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: sourceDocumentKey,
      }),
    );

    return {
      bucket: this.bucket,
      key: sourceDocumentKey,
    };
  }
}
