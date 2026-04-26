import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Roles } from "../common/decorators/roles.decorator";
import { RequestUser } from "../common/interfaces/request-user.interface";
import { NotificationsService } from "./notifications.service";
import { ListNotificationsQueryDto } from "./dto/list-notifications-query.dto";
import { UpdateNotificationPreferencesDto } from "./dto/update-notification-preferences.dto";
import { UpsertNotificationTemplateDto } from "./dto/upsert-notification-template.dto";
import { UpsertWebhookConfigDto } from "./dto/upsert-webhook-config.dto";

@ApiTags("notifications")
@Controller({ path: "notifications", version: "1" })
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @Roles(
    "tenant_admin",
    "viewer",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
    "project_manager",
  )
  listNotifications(
    @Req() request: { user?: RequestUser },
    @Query() query: ListNotificationsQueryDto,
  ) {
    return this.notificationsService.listNotifications(request.user, query);
  }

  @Patch(":id/read")
  @Roles(
    "tenant_admin",
    "viewer",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
    "project_manager",
  )
  markRead(@Param("id") id: string, @Req() request: { user?: RequestUser }) {
    return this.notificationsService.markRead(id, request.user);
  }

  @Get("preferences")
  @Roles(
    "tenant_admin",
    "viewer",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
    "project_manager",
  )
  listPreferences(
    @Req() request: { user?: RequestUser },
    @Query("eventType") eventType?: string,
  ) {
    return this.notificationsService.listPreferences(request.user, eventType);
  }

  @Put("preferences")
  @Roles(
    "tenant_admin",
    "viewer",
    "finance_manager",
    "hr_manager",
    "supply_chain_manager",
    "project_manager",
  )
  upsertPreference(
    @Req() request: { user?: RequestUser },
    @Body() dto: UpdateNotificationPreferencesDto,
  ) {
    return this.notificationsService.upsertPreference(request.user, dto);
  }

  @Get("templates")
  @Roles("tenant_admin")
  listTemplates(
    @Req() request: { user?: RequestUser },
    @Query("eventType") eventType?: string,
    @Query("channel") channel?: string,
  ) {
    return this.notificationsService.listTemplates(
      request.user,
      eventType,
      channel,
    );
  }

  @Put("templates")
  @Roles("tenant_admin")
  upsertTemplate(
    @Req() request: { user?: RequestUser },
    @Body() dto: UpsertNotificationTemplateDto,
  ) {
    return this.notificationsService.upsertTemplate(request.user, dto);
  }

  @Get("webhooks")
  @Roles("tenant_admin")
  listWebhookConfigs(@Req() request: { user?: RequestUser }) {
    return this.notificationsService.listWebhookConfigs(request.user);
  }

  @Post("webhooks")
  @Roles("tenant_admin")
  createWebhookConfig(
    @Req() request: { user?: RequestUser },
    @Body() dto: UpsertWebhookConfigDto,
  ) {
    return this.notificationsService.createWebhookConfig(request.user, dto);
  }

  @Patch("webhooks/:id")
  @Roles("tenant_admin")
  updateWebhookConfig(
    @Param("id") id: string,
    @Req() request: { user?: RequestUser },
    @Body() dto: UpsertWebhookConfigDto,
  ) {
    return this.notificationsService.updateWebhookConfig(id, request.user, dto);
  }
}
