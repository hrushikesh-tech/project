import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { ClsService } from "nestjs-cls";
import { Observable, tap } from "rxjs";
import { PrismaService } from "../../prisma/prisma.service";

type AuditRequest = {
  method: string;
  path: string;
  params?: { id?: string };
  user?: { userId?: string; tenantId?: string };
  ip?: string;
  headers?: { "user-agent"?: string };
};

type AuditableDelegate = {
  findUnique(args: { where: { id: string } }): Promise<unknown>;
};

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<AuditRequest>();
    const method = request.method;

    // Only audit mutations (D-11: POST, PUT, PATCH, DELETE)
    if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
      return next.handle();
    }

    const entityType = this.extractEntityType(request.path);
    const entityId = request.params?.id;
    let beforeSnapshot: unknown = null;

    // Capture before-state for updates and deletes (D-10: full record clone)
    if (["PUT", "PATCH", "DELETE"].includes(method) && entityId) {
      try {
        beforeSnapshot = await this.fetchEntity(entityType, entityId);
      } catch {
        // Entity lookup failed — proceed without before snapshot
        beforeSnapshot = null;
      }
    }

    return next.handle().pipe(
      tap({
        next: async (responseBody: unknown) => {
          try {
            const responseId = this.extractResponseId(responseBody);
            // Write to AuditLog (D-12: TimescaleDB hypertable)
            await this.prisma.auditLog.create({
              data: {
                action: this.mapHttpMethodToAction(method),
                entityType,
                entityId: entityId || responseId || "unknown",
                before: beforeSnapshot
                  ? JSON.parse(JSON.stringify(beforeSnapshot))
                  : null,
                after: responseBody
                  ? JSON.parse(JSON.stringify(responseBody))
                  : null,
                userId: request.user?.userId || "anonymous",
                tenantId:
                  request.user?.tenantId ||
                  this.cls.get<string>("tenantId") ||
                  "system",
                ipAddress: request.ip,
                userAgent: request.headers?.["user-agent"] || null,
                timestamp: new Date(),
              },
            });
          } catch (error) {
            // Log audit failure but don't block the response
            console.error("Audit log write failed:", error);
          }
        },
      }),
    );
  }

  private extractEntityType(path: string): string {
    const segments = path.split("/").filter(Boolean);
    const vIndex = segments.findIndex((s) => s.startsWith("v"));

    if (vIndex !== -1) {
      return segments[vIndex + 2] || segments[vIndex + 1] || "unknown";
    } else {
      return segments[1] || segments[0] || "unknown";
    }
  }

  private extractResponseId(responseBody: unknown) {
    if (
      responseBody &&
      typeof responseBody === "object" &&
      "id" in responseBody &&
      typeof responseBody.id === "string"
    ) {
      return responseBody.id;
    }

    return null;
  }

  private mapHttpMethodToAction(method: string): string {
    const map: Record<string, string> = {
      POST: "CREATE",
      PUT: "UPDATE",
      PATCH: "UPDATE",
      DELETE: "DELETE",
    };
    return map[method] || method;
  }

  private async fetchEntity(entityType: string, id: string): Promise<unknown> {
    const modelMap: Record<string, string> = {
      users: "user",
      entities: "legalEntity",
      finance: "legalEntity", // Support for module-level paths
      accounts: "account",
      journals: "journalEntry",
      invoices: "invoice",
      employees: "employee",
      departments: "department",
      "purchase-orders": "purchaseOrder",
    };
    const model = modelMap[entityType];
    const delegates = this.prisma as unknown as Record<
      string,
      AuditableDelegate | undefined
    >;
    const delegate = model ? delegates[model] : undefined;
    if (!delegate) return null;
    return delegate.findUnique({ where: { id } });
  }
}
