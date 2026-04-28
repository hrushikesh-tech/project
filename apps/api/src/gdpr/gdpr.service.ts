import { randomUUID } from "node:crypto";
import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth/auth.service";
import { PayslipStorageService } from "../payroll/storage/payslip-storage.service";
import { PrismaService } from "../prisma/prisma.service";
import {
  encryptJsonEnvelope,
  signDownloadToken,
  verifyDownloadToken,
} from "./gdpr.crypto";
import { listGdprRetentionPolicies } from "./gdpr-retention.policy";
import { serializeGdprValue } from "./gdpr.serialization";
import { GdprStorageService } from "./gdpr-storage.service";

type GdprRequestRecord = {
  id: string;
  tenantId: string;
  subjectUserId: string;
  requestedByUserId: string | null;
  kind: string;
  status: string;
  traceId: string;
  processingStartedAt: Date | null;
  completedAt: Date | null;
  failureReason: string | null;
  artifactMetadata: Record<string, unknown> | null;
  retentionNotes: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type GdprRequestDelegate = {
  findFirst(args: Record<string, unknown>): Promise<GdprRequestRecord | null>;
  create(args: Record<string, unknown>): Promise<GdprRequestRecord>;
  update(args: Record<string, unknown>): Promise<GdprRequestRecord>;
};

type DbDelegate = {
  findFirst<T = Record<string, unknown>>(
    args: Record<string, unknown>,
  ): Promise<T | null>;
  findMany?<T = Record<string, unknown>>(
    args: Record<string, unknown>,
  ): Promise<T[]>;
  update?<T = Record<string, unknown>>(
    args: Record<string, unknown>,
  ): Promise<T>;
  updateMany?(args: Record<string, unknown>): Promise<unknown>;
};

type TenantDb = {
  user: DbDelegate;
  employee: DbDelegate;
  payrollResult: DbDelegate;
  payslip: DbDelegate;
  notification: DbDelegate;
  notificationPreference: DbDelegate;
  auditLog: DbDelegate;
  userSession?: DbDelegate;
  dashboard?: DbDelegate;
};

type TransactionTenantDb = {
  user: { update(args: Record<string, unknown>): Promise<unknown> };
  employee: { update(args: Record<string, unknown>): Promise<unknown> };
  payrollResult: {
    updateMany(args: Record<string, unknown>): Promise<unknown>;
  };
  payslip: { updateMany(args: Record<string, unknown>): Promise<unknown> };
  notification: { updateMany(args: Record<string, unknown>): Promise<unknown> };
  notificationPreference: {
    updateMany(args: Record<string, unknown>): Promise<unknown>;
  };
};

type GdprDownloadResult = {
  fileName: string;
  contentType: string;
  body: Buffer;
};

type GdprRequestView = GdprRequestRecord & {
  downloadUrl?: string | null;
};

@Injectable()
export class GdprService {
  private readonly exportRetentionDays: number;
  private readonly exportDownloadTtlMinutes: number;
  private readonly exportEncryptionSecret: string;
  private readonly exportDownloadSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
    private readonly payslipStorageService: PayslipStorageService,
    private readonly storageService: GdprStorageService,
    configService: ConfigService,
  ) {
    this.exportRetentionDays = Number(
      configService.get("GDPR_EXPORT_RETENTION_DAYS", 30),
    );
    this.exportDownloadTtlMinutes = Number(
      configService.get("GDPR_EXPORT_DOWNLOAD_TTL_MINUTES", 30),
    );
    this.exportEncryptionSecret =
      configService.get<string>("GDPR_EXPORT_ENCRYPTION_SECRET") ?? "";
    this.exportDownloadSecret =
      configService.get<string>("GDPR_EXPORT_DOWNLOAD_SECRET") ?? "";
  }

  async requestExport(params: {
    tenantId: string;
    subjectUserId: string;
    requestedByUserId: string;
  }) {
    const request = await this.createRequest({
      ...params,
      kind: "EXPORT",
    });

    return this.processExportRequest(request.id);
  }

  async requestErasure(params: {
    tenantId: string;
    subjectUserId: string;
    requestedByUserId: string;
  }) {
    const request = await this.createRequest({
      ...params,
      kind: "ERASURE",
    });

    return this.processErasureRequest(request.id);
  }

  async getRequest(tenantId: string, requestId: string) {
    const request = await this.findRequest(tenantId, requestId);
    if (!request) {
      throw new NotFoundException("GDPR request not found.");
    }

    return this.toRequestView(request);
  }

  async downloadExport(tenantId: string, requestId: string, token: string) {
    const request = await this.findRequest(tenantId, requestId);
    if (!request) {
      throw new NotFoundException("GDPR request not found.");
    }

    const artifact = this.readArtifactMetadata(request);
    if (
      !artifact ||
      request.kind !== "EXPORT" ||
      request.status !== "EXPORT_READY"
    ) {
      throw new NotFoundException(
        "No export artifact is available for this request.",
      );
    }

    this.ensureDownloadTokenMatches(token, request, artifact);
    const key = this.readStringMetadata(artifact, "key");
    const body = await this.storageService.getExportArtifactBuffer(key);

    return {
      fileName: `gdpr-export-${request.subjectUserId}.json`,
      contentType: "application/json",
      body,
    } satisfies GdprDownloadResult;
  }

  listRetentionPolicies() {
    return listGdprRetentionPolicies(this.exportRetentionDays);
  }

  private async createRequest(params: {
    tenantId: string;
    subjectUserId: string;
    requestedByUserId: string;
    kind: "EXPORT" | "ERASURE";
  }) {
    const request = await this.getRequestDelegate().create({
      data: {
        tenantId: params.tenantId,
        subjectUserId: params.subjectUserId,
        requestedByUserId: params.requestedByUserId,
        kind: params.kind,
        status: "REQUESTED",
        traceId: randomUUID(),
        retentionNotes: this.listRetentionSnapshot(),
      },
    });

    await this.recordAudit({
      tenantId: params.tenantId,
      subjectUserId: params.subjectUserId,
      action:
        params.kind === "EXPORT"
          ? "GDPR_EXPORT_REQUESTED"
          : "GDPR_ERASURE_REQUESTED",
      requestId: request.id,
      requestedByUserId: params.requestedByUserId,
    });

    return request;
  }

  private async processExportRequest(requestId: string) {
    const request = await this.requireRequest(requestId);
    const now = new Date();
    const requestDelegate = this.getRequestDelegate();
    await requestDelegate.update({
      where: { id: request.id },
      data: {
        status: "PROCESSING",
        processingStartedAt: now,
        failureReason: null,
      },
    });

    try {
      this.assertSecretsConfigured();
      const payload = await this.buildExportPayload(request);
      const envelope = encryptJsonEnvelope(
        payload,
        this.exportEncryptionSecret,
      );
      const artifactBytes = Buffer.from(JSON.stringify(envelope), "utf8");
      const artifact = await this.storageService.uploadEncryptedExport({
        tenantId: request.tenantId,
        requestId: request.id,
        body: artifactBytes,
      });
      const downloadTokenExpiresAt = new Date(
        now.getTime() + this.exportDownloadTtlMinutes * 60 * 1000,
      );
      const downloadToken = signDownloadToken(
        {
          requestId: request.id,
          artifactKey: artifact.key,
          expiresAt: downloadTokenExpiresAt.toISOString(),
        },
        this.exportDownloadSecret,
      );

      const artifactMetadata = {
        ...artifact,
        checksum: envelope.checksum,
        algorithm: envelope.algorithm,
        downloadTokenExpiresAt: downloadTokenExpiresAt.toISOString(),
      };
      const completed = await requestDelegate.update({
        where: { id: request.id },
        data: {
          status: "EXPORT_READY",
          completedAt: new Date(),
          artifactMetadata,
          retentionNotes: this.listRetentionSnapshot(),
        },
      });

      await this.recordAudit({
        tenantId: request.tenantId,
        subjectUserId: request.subjectUserId,
        action: "GDPR_EXPORT_READY",
        requestId: request.id,
        requestedByUserId: request.requestedByUserId ?? request.subjectUserId,
        metadata: artifactMetadata,
      });

      return this.toRequestView(completed, downloadToken);
    } catch (error) {
      await requestDelegate.update({
        where: { id: request.id },
        data: {
          status: "FAILED",
          failureReason: (error as Error).message,
          completedAt: new Date(),
        },
      });

      await this.recordAudit({
        tenantId: request.tenantId,
        subjectUserId: request.subjectUserId,
        action: "GDPR_EXPORT_FAILED",
        requestId: request.id,
        requestedByUserId: request.requestedByUserId ?? request.subjectUserId,
        metadata: { failureReason: (error as Error).message },
      });

      throw error;
    }
  }

  private async processErasureRequest(requestId: string) {
    const request = await this.requireRequest(requestId);
    const now = new Date();
    const requestDelegate = this.getRequestDelegate();
    await requestDelegate.update({
      where: { id: request.id },
      data: {
        status: "PROCESSING",
        processingStartedAt: now,
        failureReason: null,
      },
    });

    const db = this.prisma.forTenant(request.tenantId) as unknown as TenantDb;

    const user = await db.user.findFirst({
      where: { id: request.subjectUserId, includeDeleted: true },
    });
    const employee = await db.employee.findFirst({
      where: { userId: request.subjectUserId, includeDeleted: true },
      orderBy: { updatedAt: "desc" },
    });
    const payslips = employee
      ? await db.payslip.findMany({
          where: { employeeId: employee.id, includeDeleted: true },
          select: { id: true, storageKey: true },
        })
      : [];

    await this.prisma.$transaction(async (tx) => {
      const transactionDb = tx as unknown as TransactionTenantDb;

      if (user) {
        await transactionDb.user.update({
          where: { id: user.id },
          data: {
            email: `gdpr-${user.id}@redacted.invalid`,
            firstName: "Redacted",
            lastName: "Subject",
            keycloakId: `gdpr-${user.id}`,
            role: "viewer",
            isActive: false,
            lastLoginAt: null,
            deletedAt: now,
          },
        });
      }

      if (employee) {
        await transactionDb.employee.update({
          where: { id: employee.id },
          data: {
            employeeCode: `GDPR-${employee.id.slice(0, 8).toUpperCase()}`,
            firstName: "Redacted",
            lastName: "Employee",
            email: `gdpr-employee-${employee.id}@redacted.invalid`,
            phone: null,
            dateOfBirth: null,
            userId: null,
            status: "TERMINATED",
            terminationDate: employee.terminationDate ?? now,
            deletedAt: now,
          },
        });

        await transactionDb.payrollResult.updateMany({
          where: { employeeId: employee.id },
          data: {
            inputSnapshot: null,
            failureReason: null,
            deletedAt: now,
          },
        });

        await transactionDb.payslip.updateMany({
          where: { employeeId: employee.id },
          data: {
            pdfUrl: null,
            storageBucket: null,
            storageKey: null,
            fileName: null,
            contentType: null,
            renderMetadata: null,
            deletedAt: now,
          },
        });
      }

      await transactionDb.notification.updateMany({
        where: { userId: request.subjectUserId },
        data: {
          deletedAt: now,
        },
      });

      await transactionDb.notificationPreference.updateMany({
        where: { userId: request.subjectUserId },
        data: {
          deletedAt: now,
        },
      });
    });

    const artifactCleanupResults = await Promise.allSettled(
      payslips
        .map((payslip) => payslip.storageKey)
        .filter((storageKey): storageKey is string => Boolean(storageKey))
        .map((storageKey) =>
          this.payslipStorageService.deletePayslipArtifact(storageKey),
        ),
    );
    const cleanupWarnings = artifactCleanupResults
      .filter((result) => result.status === "rejected")
      .map((result) =>
        result.status === "rejected" ? (result.reason as Error).message : "",
      )
      .filter((message) => message.length > 0);

    const cleanupSummary = await this.authService.cleanupSessionsForUser(
      request.tenantId,
      request.subjectUserId,
      "gdpr_erasure",
    );
    const normalizedCleanupSummary = serializeGdprValue(cleanupSummary);

    const completed = await requestDelegate.update({
      where: { id: request.id },
      data: {
        status: "PSEUDONYMIZED",
        completedAt: new Date(),
        artifactMetadata: {
          cleanupSummary: normalizedCleanupSummary,
          payslipArtifactCount: payslips.length,
          cleanupWarnings,
        },
        retentionNotes: this.listRetentionSnapshot(),
      },
    });

    await this.recordAudit({
      tenantId: request.tenantId,
      subjectUserId: request.subjectUserId,
      action: "GDPR_ERASURE_COMPLETED",
      requestId: request.id,
      requestedByUserId: request.requestedByUserId ?? request.subjectUserId,
      metadata: {
        cleanupSummary: normalizedCleanupSummary,
        cleanupWarnings,
        employeeId: employee?.id ?? null,
      },
    });

    return this.toRequestView(completed);
  }

  private async buildExportPayload(request: GdprRequestRecord) {
    const db = this.prisma.forTenant(request.tenantId) as unknown as Required<
      Pick<
        TenantDb,
        | "user"
        | "employee"
        | "userSession"
        | "notification"
        | "notificationPreference"
        | "payrollResult"
        | "payslip"
        | "dashboard"
        | "auditLog"
      >
    >;

    const user = await db.user.findFirst({
      where: { id: request.subjectUserId, includeDeleted: true },
    });
    const employee = await db.employee.findFirst({
      where: { userId: request.subjectUserId, includeDeleted: true },
      orderBy: { updatedAt: "desc" },
    });

    const [
      sessions,
      notifications,
      notificationPreferences,
      dashboards,
      auditLogs,
    ] = await Promise.all([
      db.userSession.findMany({
        where: { userId: request.subjectUserId, includeDeleted: true },
        orderBy: [{ updatedAt: "desc" }],
      }),
      db.notification.findMany({
        where: { userId: request.subjectUserId, includeDeleted: true },
        orderBy: [{ createdAt: "desc" }],
      }),
      db.notificationPreference.findMany({
        where: { userId: request.subjectUserId, includeDeleted: true },
        orderBy: [{ createdAt: "desc" }],
      }),
      db.dashboard.findMany({
        where: { ownerId: request.subjectUserId, includeDeleted: true },
        orderBy: [{ updatedAt: "desc" }],
        select: {
          id: true,
          title: true,
          description: true,
          isPublic: true,
          layout: true,
          defaultFilters: true,
          createdAt: true,
          updatedAt: true,
          deletedAt: true,
        },
      }),
      db.auditLog.findMany({
        where: { userId: request.subjectUserId },
        orderBy: [{ timestamp: "desc" }],
        take: 100,
      }),
    ]);

    const payrollResults = employee
      ? await db.payrollResult.findMany({
          where: { employeeId: employee.id, includeDeleted: true },
          orderBy: [{ updatedAt: "desc" }],
        })
      : [];
    const payslips = employee
      ? await db.payslip.findMany({
          where: { employeeId: employee.id, includeDeleted: true },
          orderBy: [{ updatedAt: "desc" }],
        })
      : [];

    return serializeGdprValue({
      request: {
        id: request.id,
        traceId: request.traceId,
        kind: request.kind,
        status: request.status,
        requestedByUserId: request.requestedByUserId,
        subjectUserId: request.subjectUserId,
        createdAt: request.createdAt,
      },
      subject: {
        user,
        employee,
        sessions,
        notifications,
        notificationPreferences,
        payrollResults,
        payslips,
        dashboards,
        auditLogs,
      },
      retentionNotes: this.listRetentionSnapshot(),
      exportedAt: new Date().toISOString(),
    });
  }

  private async findRequest(tenantId: string, requestId: string) {
    return this.getRequestDelegate().findFirst({
      where: {
        id: requestId,
        tenantId,
      },
    });
  }

  private async requireRequest(requestId: string) {
    const request = await this.getRequestDelegate().findFirst({
      where: { id: requestId },
    });

    if (!request) {
      throw new NotFoundException("GDPR request not found.");
    }

    return request;
  }

  private toRequestView(
    request: GdprRequestRecord,
    downloadToken?: string,
  ): GdprRequestView {
    const artifact = this.readArtifactMetadata(request);
    const downloadUrl =
      downloadToken && artifact
        ? `/api/v1/gdpr/requests/${request.id}/download?token=${encodeURIComponent(downloadToken)}`
        : artifact &&
            request.kind === "EXPORT" &&
            request.status === "EXPORT_READY"
          ? this.buildDownloadUrl(request, artifact)
          : null;

    return {
      ...request,
      downloadUrl: downloadUrl ?? undefined,
    };
  }

  private buildDownloadUrl(
    request: GdprRequestRecord,
    artifact: Record<string, unknown>,
  ) {
    const token = signDownloadToken(
      {
        requestId: request.id,
        artifactKey: this.readStringMetadata(artifact, "key"),
        expiresAt: this.readStringMetadata(artifact, "downloadTokenExpiresAt"),
      },
      this.exportDownloadSecret,
    );

    return `/api/v1/gdpr/requests/${request.id}/download?token=${encodeURIComponent(token)}`;
  }

  private ensureDownloadTokenMatches(
    token: string,
    request: GdprRequestRecord,
    artifact: Record<string, unknown>,
  ) {
    this.assertSecretsConfigured();
    try {
      const payload = verifyDownloadToken(token, this.exportDownloadSecret);
      if (
        payload.requestId !== request.id ||
        payload.artifactKey !== this.readStringMetadata(artifact, "key") ||
        payload.expiresAt !==
          this.readStringMetadata(artifact, "downloadTokenExpiresAt")
      ) {
        throw new UnauthorizedException(
          "Download token does not match this export.",
        );
      }

      if (new Date(payload.expiresAt).getTime() < Date.now()) {
        throw new UnauthorizedException("Download token has expired.");
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException(
        (error as Error).message || "Download token is invalid.",
      );
    }
  }

  private readArtifactMetadata(request: GdprRequestRecord) {
    return request.artifactMetadata ?? null;
  }

  private readStringMetadata(
    artifact: Record<string, unknown>,
    key: string,
  ): string {
    const value = artifact[key];
    if (typeof value !== "string" || value.length === 0) {
      throw new ServiceUnavailableException(
        `GDPR request artifact metadata is missing ${key}.`,
      );
    }

    return value;
  }

  private listRetentionSnapshot() {
    return listGdprRetentionPolicies(this.exportRetentionDays);
  }

  private getRequestDelegate() {
    const delegate = (this.prisma.raw as unknown as Record<string, unknown>)
      .gdprRequest;
    if (!delegate) {
      throw new ServiceUnavailableException(
        "GdprRequest Prisma model is unavailable. Regenerate the Prisma client after adding the Phase 18 GDPR schema.",
      );
    }

    return delegate as GdprRequestDelegate;
  }

  private async recordAudit(params: {
    tenantId: string;
    subjectUserId: string;
    requestId: string;
    requestedByUserId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }) {
    const metadata = params.metadata
      ? serializeGdprValue(params.metadata)
      : null;

    await this.prisma.auditLog.create({
      data: {
        action: params.action,
        entityType: "gdprRequest",
        entityId: params.requestId,
        before: null,
        after: metadata,
        userId: params.requestedByUserId,
        tenantId: params.tenantId,
        ipAddress: null,
        userAgent: null,
        metadata: {
          subjectUserId: params.subjectUserId,
          requestId: params.requestId,
        },
        timestamp: new Date(),
      },
    });
  }

  private assertSecretsConfigured() {
    if (!this.exportEncryptionSecret || !this.exportDownloadSecret) {
      throw new ServiceUnavailableException(
        "GDPR export encryption and download signing secrets must be configured before the workflow is enabled.",
      );
    }
  }
}
