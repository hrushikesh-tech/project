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
export class GdprStorageService {
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly client: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>("AWS_S3_BUCKET", "");
    this.prefix = this.configService.get<string>(
      "GDPR_EXPORT_ARTIFACT_PREFIX",
      "gdpr-exports",
    );
    this.client = new S3Client({
      region: this.configService.get<string>("AWS_REGION"),
      endpoint: this.configService.get<string>("AWS_S3_ENDPOINT") || undefined,
      forcePathStyle:
        this.configService.get<string>("AWS_S3_FORCE_PATH_STYLE") === "true",
      credentials: {
        accessKeyId: this.configService.get<string>("AWS_ACCESS_KEY_ID", ""),
        secretAccessKey: this.configService.get<string>(
          "AWS_SECRET_ACCESS_KEY",
          "",
        ),
      },
    });
  }

  async uploadEncryptedExport(params: {
    tenantId: string;
    requestId: string;
    body: Buffer;
  }) {
    const key = `${this.prefix}/${params.tenantId}/${params.requestId}/export.json`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.body,
        ContentType: "application/json",
      }),
    );

    return {
      bucket: this.bucket,
      key,
      contentType: "application/json",
      size: params.body.byteLength,
    };
  }

  async getExportArtifactStream(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    const body = response.Body;
    if (body instanceof Readable) {
      return body;
    }

    if (hasWebStreamTransform(body)) {
      return Readable.fromWeb(body.transformToWebStream());
    }

    throw new Error(`Unable to read GDPR export artifact stream for ${key}.`);
  }

  async getExportArtifactBuffer(key: string) {
    const stream = await this.getExportArtifactStream(key);
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }

  async deleteExportArtifact(key: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    return {
      bucket: this.bucket,
      key,
    };
  }
}
