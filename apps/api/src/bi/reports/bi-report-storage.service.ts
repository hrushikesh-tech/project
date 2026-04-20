import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BiReportStorageService {
  private readonly bucket: string;
  private readonly prefix: string;
  private readonly endpoint?: string;
  private readonly client: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>("AWS_S3_BUCKET", "");
    this.prefix = this.configService.get<string>(
      "BI_REPORT_ARTIFACT_PREFIX",
      "bi-reports",
    );
    this.endpoint =
      this.configService.get<string>("AWS_S3_ENDPOINT") || undefined;
    this.client = new S3Client({
      region: this.configService.get<string>("AWS_REGION"),
      endpoint: this.endpoint,
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

  async uploadArtifact(params: {
    tenantId: string;
    dashboardId: string;
    reportRunId: string;
    format: "PDF" | "EXCEL";
    body: Buffer;
  }) {
    const extension = params.format === "PDF" ? "pdf" : "xls";
    const contentType =
      params.format === "PDF" ? "application/pdf" : "application/vnd.ms-excel";
    const key = `${this.prefix}/${params.tenantId}/${params.dashboardId}/${params.reportRunId}.${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.body,
        ContentType: contentType,
      }),
    );

    return {
      bucket: this.bucket,
      key,
      format: params.format,
      contentType,
      url: this.buildArtifactUrl(key),
    };
  }

  private buildArtifactUrl(key: string) {
    const baseUrl = this.configService.get<string>("BI_REPORT_BASE_URL");
    if (baseUrl) {
      return `${baseUrl.replace(/\/$/, "")}/${key}`;
    }
    if (this.endpoint) {
      return `${this.endpoint.replace(/\/$/, "")}/${this.bucket}/${key}`;
    }
    return `https://s3.amazonaws.com/${this.bucket}/${key}`;
  }
}
