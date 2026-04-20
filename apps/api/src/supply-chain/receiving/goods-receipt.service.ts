import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@amdox/db";
import {
  GoodsReceiptQuantityExceeded,
  InventoryMovementType,
  InvalidPurchaseOrderTransition,
  PurchaseOrderStatus,
} from "@amdox/types";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateGoodsReceiptDto } from "../dto/create-goods-receipt.dto";
import { serializeSupplyChainValue } from "../supply-chain.serialization";

@Injectable()
export class GoodsReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async createGoodsReceipt(dto: CreateGoodsReceiptDto) {
    return serializeSupplyChainValue(
      await this.prisma.$transaction(async (tx) => {
        const tenantId = this.requireTenantId();
        const purchaseOrder = await tx.purchaseOrder.findFirst({
          where: {
            id: dto.purchaseOrderId,
            tenantId,
            deletedAt: null,
          },
          include: {
            lines: true,
          },
        });
        if (!purchaseOrder) {
          throw new NotFoundException("Purchase order not found.");
        }

        if (
          ![
            PurchaseOrderStatus.APPROVED,
            PurchaseOrderStatus.SENT_TO_VENDOR,
            PurchaseOrderStatus.PARTIALLY_RECEIVED,
          ].includes(purchaseOrder.status as PurchaseOrderStatus)
        ) {
          throw new InvalidPurchaseOrderTransition(
            "Goods receipts can only be posted for approved, sent, or partially received purchase orders.",
          );
        }

        const warehouse = await tx.warehouse.findFirst({
          where: {
            id: dto.warehouseId,
            tenantId,
            deletedAt: null,
          },
        });
        if (!warehouse) {
          throw new NotFoundException("Warehouse not found.");
        }

        const lineMap = new Map(
          purchaseOrder.lines.map((line) => [line.id, line]),
        );
        for (const receiptLine of dto.lines) {
          const purchaseOrderLine = lineMap.get(
            receiptLine.purchaseOrderLineId,
          );
          if (!purchaseOrderLine) {
            throw new NotFoundException(
              "Goods receipt line references a purchase-order line that does not belong to this order.",
            );
          }

          const requestedQuantity = this.toDecimal(
            receiptLine.quantityReceived,
          );
          const nextReceived = new Prisma.Decimal(
            purchaseOrderLine.receivedQuantity.toString(),
          ).add(requestedQuantity);

          if (nextReceived.greaterThan(purchaseOrderLine.quantity)) {
            throw new GoodsReceiptQuantityExceeded();
          }
        }

        const goodsReceipt = await tx.goodsReceipt.create({
          data: {
            tenantId,
            purchaseOrderId: purchaseOrder.id,
            legalEntityId: purchaseOrder.legalEntityId,
            warehouseId: dto.warehouseId,
            receivedDate: new Date(),
            receivedBy: dto.receivedBy?.trim() ?? "system",
          },
        });

        await tx.goodsReceiptLine.createMany({
          data: dto.lines.map((line) => ({
            tenantId,
            goodsReceiptId: goodsReceipt.id,
            purchaseOrderLineId: line.purchaseOrderLineId,
            quantityReceived: this.toDecimal(line.quantityReceived),
          })),
        });

        for (const receiptLine of dto.lines) {
          const purchaseOrderLine = lineMap.get(
            receiptLine.purchaseOrderLineId,
          );
          const quantityReceived = this.toDecimal(receiptLine.quantityReceived);
          const updatedReceivedQuantity = new Prisma.Decimal(
            purchaseOrderLine.receivedQuantity.toString(),
          ).add(quantityReceived);

          await tx.purchaseOrderLine.update({
            where: { id: purchaseOrderLine.id },
            data: {
              receivedQuantity: updatedReceivedQuantity,
            },
          });

          const existingInventoryItem = await tx.inventoryItem.findFirst({
            where: {
              tenantId,
              productId: purchaseOrderLine.productId,
              warehouseId: dto.warehouseId,
              deletedAt: null,
            },
          });

          if (existingInventoryItem) {
            await tx.inventoryItem.update({
              where: { id: existingInventoryItem.id },
              data: {
                quantity: new Prisma.Decimal(
                  existingInventoryItem.quantity.toString(),
                ).add(quantityReceived),
              },
            });
          } else {
            await tx.inventoryItem.create({
              data: {
                tenantId,
                productId: purchaseOrderLine.productId,
                warehouseId: dto.warehouseId,
                quantity: quantityReceived,
                reservedQuantity: new Prisma.Decimal("0"),
              },
            });
          }

          const costLayer = await tx.costLayer.create({
            data: {
              tenantId,
              productId: purchaseOrderLine.productId,
              warehouseId: dto.warehouseId,
              quantity: quantityReceived,
              unitCost: purchaseOrderLine.unitPrice,
              remainingQuantity: quantityReceived,
              receivedAt: goodsReceipt.receivedDate,
            },
          });

          await tx.inventoryMovement.create({
            data: {
              tenantId,
              movementType: InventoryMovementType.RECEIPT,
              productId: purchaseOrderLine.productId,
              warehouseId: dto.warehouseId,
              legalEntityId: purchaseOrder.legalEntityId,
              costLayerId: costLayer.id,
              goodsReceiptId: goodsReceipt.id,
              purchaseOrderId: purchaseOrder.id,
              quantity: quantityReceived,
              unitCost: purchaseOrderLine.unitPrice,
              referenceType: "GOODS_RECEIPT",
              referenceId: goodsReceipt.id,
              notes: `Received against PO ${purchaseOrder.poNumber}`,
              performedBy: dto.receivedBy?.trim() ?? "system",
              movedAt: goodsReceipt.receivedDate,
            },
          });
        }

        const refreshedLines = await tx.purchaseOrderLine.findMany({
          where: {
            tenantId,
            purchaseOrderId: purchaseOrder.id,
            deletedAt: null,
          },
        });
        const nextStatus = refreshedLines.every((line) =>
          new Prisma.Decimal(line.receivedQuantity.toString()).equals(
            line.quantity,
          ),
        )
          ? PurchaseOrderStatus.FULLY_RECEIVED
          : PurchaseOrderStatus.PARTIALLY_RECEIVED;

        await tx.purchaseOrder.update({
          where: { id: purchaseOrder.id },
          data: {
            status: nextStatus,
          },
        });

        return tx.goodsReceipt.findFirst({
          where: {
            id: goodsReceipt.id,
            tenantId,
            deletedAt: null,
          },
          include: {
            warehouse: true,
            lines: true,
            purchaseOrder: {
              include: {
                lines: true,
              },
            },
          },
        });
      }),
    );
  }

  private toDecimal(value: number | string | Prisma.Decimal) {
    if (value instanceof Prisma.Decimal) {
      return value;
    }
    return new Prisma.Decimal(String(value));
  }

  private requireTenantId() {
    const tenantId = this.cls.get("tenantId");
    if (!tenantId || tenantId === "*") {
      throw new ForbiddenException(
        "Supply-chain endpoints require a tenant-scoped request context.",
      );
    }
    return tenantId;
  }
}
