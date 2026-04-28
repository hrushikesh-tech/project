import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../prisma/prisma.module";
import { PayrollModule } from "../payroll/payroll.module";
import { GdprController } from "./gdpr.controller";
import { GdprService } from "./gdpr.service";
import { GdprStorageService } from "./gdpr-storage.service";

@Module({
  imports: [ConfigModule, PrismaModule, AuthModule, PayrollModule],
  controllers: [GdprController],
  providers: [GdprService, GdprStorageService],
  exports: [GdprService],
})
export class GdprModule {}
