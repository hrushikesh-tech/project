import { Injectable } from "@nestjs/common";
import { Prisma } from "@amdox/db";
import { PurchaseOrderStatus, VendorStatus } from "@amdox/types";
import { PrismaService } from "../../prisma/prisma.service";

const OPEN_PURCHASE_ORDER_STATUSES = [
  PurchaseOrderStatus.DRAFT,
  PurchaseOrderStatus.SUBMITTED,
  PurchaseOrderStatus.APPROVED,
  PurchaseOrderStatus.SENT_TO_VENDOR,
  PurchaseOrderStatus.PARTIALLY_RECEIVED,
];

@Injectable()
export class ReorderAutomationService {
  constructor(private readonly prisma: PrismaService) {}

  async runForTenant(tenantId: string) {
    const db = this.prisma.forTenant(tenantId);
    const products = await db.product.findMany({
      where: {
        deletedAt: null,
      },
      orderBy: [{ sku: "asc" }],
    });
    const settings = await db.productReplenishmentSetting.findMany({
      where: {
        deletedAt: null,
        isAutoReorderEnabled: true,
      },
      include: {
        product: true,
        vendor: true,
        legalEntity: true,
      },
      orderBy: [{ productId: "asc" }, { legalEntityId: "asc" }],
    });
    const inventoryItems = await db.inventoryItem.findMany({
      where: {
        deletedAt: null,
      },
    });

    const settingsByProduct = new Map();
    for (const setting of settings) {
      const current = settingsByProduct.get(setting.productId) ?? [];
      current.push(setting);
      settingsByProduct.set(setting.productId, current);
    }

    let createdDrafts = 0;
    let skippedMissingConfig = 0;
    let skippedBlockedVendor = 0;
    let suppressedOpenPo = 0;

    for (const product of products) {
      const stockRows = inventoryItems.filter(
        (item) => item.productId === product.id,
      );
      const availableStock = stockRows.reduce((sum, row) => {
        const quantity = new Prisma.Decimal(row.quantity.toString());
        const reserved = new Prisma.Decimal(row.reservedQuantity.toString());
        return sum.add(quantity.sub(reserved));
      }, new Prisma.Decimal("0"));

      if (availableStock.greaterThan(product.reorderPoint)) {
        continue;
      }

      const productSettings = settingsByProduct.get(product.id) ?? [];
      if (productSettings.length === 0) {
        skippedMissingConfig += 1;
        await this.recordSkip(db, {
          tenantId,
          productId: product.id,
          reason: "missing_replenishment_configuration",
          message:
            "Reorder skipped because no replenishment configuration exists for the product.",
        });
        continue;
      }

      if (productSettings.length > 1) {
        skippedMissingConfig += 1;
        await this.recordSkip(db, {
          tenantId,
          productId: product.id,
          reason: "ambiguous_replenishment_configuration",
          message:
            "Reorder skipped because multiple replenishment configurations exist for the product.",
        });
        continue;
      }

      const setting = productSettings[0];
      if (setting.vendor.status !== VendorStatus.ACTIVE) {
        skippedBlockedVendor += 1;
        await this.recordSkip(db, {
          tenantId,
          productId: product.id,
          reason: "blocked_vendor",
          message:
            "Reorder skipped because the configured vendor is not ACTIVE.",
          vendorId: setting.vendorId,
        });
        continue;
      }

      const openPurchaseOrder = await db.purchaseOrder.findFirst({
        where: {
          deletedAt: null,
          status: {
            in: OPEN_PURCHASE_ORDER_STATUSES,
          },
          lines: {
            some: {
              productId: product.id,
            },
          },
        },
      });

      if (openPurchaseOrder) {
        suppressedOpenPo += 1;
        continue;
      }

      const poNumber = this.createPurchaseOrderNumber();
      const purchaseOrder = await db.purchaseOrder.create({
        data: {
          poNumber,
          vendorId: setting.vendorId,
          legalEntityId: setting.legalEntityId,
          status: PurchaseOrderStatus.DRAFT,
          totalAmount: 0n,
          currency: setting.vendor.currency,
        },
      });

      await db.purchaseOrderLine.createMany({
        data: [
          {
            tenantId,
            purchaseOrderId: purchaseOrder.id,
            productId: product.id,
            description: `Auto reorder for ${product.name}`,
            quantity: setting.reorderQuantity,
            unitPrice: 0n,
            receivedQuantity: new Prisma.Decimal("0"),
          },
        ],
      });

      createdDrafts += 1;
    }

    return {
      tenantId,
      createdDrafts,
      skippedMissingConfig,
      skippedBlockedVendor,
      suppressedOpenPo,
    };
  }

  private async recordSkip(
    db: ReturnType<PrismaService["forTenant"]>,
    params: {
      tenantId: string;
      productId: string;
      reason: string;
      message: string;
      vendorId?: string;
    },
  ) {
    await db.outboxEvent.create({
      data: {
        tenantId: params.tenantId,
        eventType: "supply-chain.reorder.skipped",
        payload: {
          productId: params.productId,
          vendorId: params.vendorId ?? null,
          reason: params.reason,
          message: params.message,
        },
      },
    });
  }

  private createPurchaseOrderNumber() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `PO-${stamp}-${suffix}`;
  }
}
