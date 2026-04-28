import {
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { RequestUser } from "../common/interfaces/request-user.interface";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { GdprService } from "./gdpr.service";

@ApiTags("gdpr")
@Controller({ path: "gdpr", version: "1" })
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Post("requests/export")
  async requestExport(@CurrentUser() user: RequestUser) {
    return this.gdprService.requestExport({
      tenantId: this.requireTenantId(user),
      subjectUserId: user.userId,
      requestedByUserId: user.userId,
    });
  }

  @Post("requests/erasure")
  async requestErasure(@CurrentUser() user: RequestUser) {
    return this.gdprService.requestErasure({
      tenantId: this.requireTenantId(user),
      subjectUserId: user.userId,
      requestedByUserId: user.userId,
    });
  }

  @Get("requests/:requestId")
  async getRequest(
    @Param("requestId") requestId: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.gdprService.getRequest(this.requireTenantId(user), requestId);
  }

  @Get("requests/:requestId/download")
  async downloadExport(
    @Param("requestId") requestId: string,
    @Query("token") token: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.gdprService.downloadExport(
      this.requireTenantId(user),
      requestId,
      token,
    );

    res.setHeader("Content-Type", result.contentType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${result.fileName}"`,
    );
    res.setHeader("Cache-Control", "no-store");
    return result.body.toString("utf8");
  }

  @Get("retention-policies")
  listRetentionPolicies() {
    return this.gdprService.listRetentionPolicies();
  }

  private requireTenantId(user: RequestUser) {
    if (!user.tenantId) {
      throw new UnauthorizedException(
        "Tenant context is required for GDPR requests.",
      );
    }

    return user.tenantId;
  }
}
