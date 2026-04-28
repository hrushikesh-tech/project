import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class PayslipStorageService {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.get<string>("AWS_S3_BUCKET", "");
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

  async uploadPayslip(params: {
    tenantId: string;
    payrollRunId: string;
    employeeId: string;
    body: Buffer;
  }) {
    const key = `payslips/${params.tenantId}/${params.payrollRunId}/${params.employeeId}.pdf`;
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.body,
        ContentType: "application/pdf",
      }),
    );

    return {
      bucket: this.bucket,
      key,
      fileName: `${params.employeeId}.pdf`,
      contentType: "application/pdf",
    };
  }

  async deletePayslipArtifact(storageKey: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey,
      }),
    );

    return {
      bucket: this.bucket,
      key: storageKey,
    };
  }
}
