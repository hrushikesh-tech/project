import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@amdox/db";
import {
  InsufficientStockException,
  InventoryMovementType,
} from "@amdox/types";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsumeInventoryDto } from "../dto/consume-inventory.dto";
import { serializeSupplyChainValue } from "../supply-chain.serialization";

@Injectable()
export class FifoInventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async consumeInventory(dto: ConsumeInventoryDto) {
    return serializeSupplyChainValue(
      await this.prisma.$transaction(async (tx) => {
        const tenantId = this.requireTenantId();
        const inventoryItem = await tx.inventoryItem.findFirst({
          where: {
            tenantId,
            productId: dto.productId,
            warehouseId: dto.warehouseId,
            deletedAt: null,
          },
        });

        if (!inventoryItem) {
          throw new NotFoundException("Inventory item not found.");
        }

        const requestedQuantity = this.toDecimal(dto.quantity);
        const availableQuantity = new Prisma.Decimal(
          inventoryItem.quantity.toString(),
        );

        if (availableQuantity.lessThan(requestedQuantity)) {
          throw new InsufficientStockException();
        }

        const costLayers = (
          await tx.costLayer.findMany({
            where: {
              tenantId,
              productId: dto.productId,
              warehouseId: dto.warehouseId,
              deletedAt: null,
            },
            orderBy: [{ receivedAt: "asc" }, { createdAt: "asc" }],
          })
        ).filter((layer) =>
          new Prisma.Decimal(layer.remainingQuantity.toString()).greaterThan(
            new Prisma.Decimal("0"),
          ),
        );

        const layerAvailable = costLayers.reduce(
          (sum, layer) =>
            sum.add(new Prisma.Decimal(layer.remainingQuantity.toString())),
          new Prisma.Decimal("0"),
        );

        if (layerAvailable.lessThan(requestedQuantity)) {
          throw new InsufficientStockException();
        }

        let remainingToConsume = new Prisma.Decimal(
          requestedQuantity.toString(),
        );
        for (const layer of costLayers) {
          if (remainingToConsume.equals(new Prisma.Decimal("0"))) {
            break;
          }

          const layerRemaining = new Prisma.Decimal(
            layer.remainingQuantity.toString(),
          );
          const consumedQuantity = Prisma.Decimal.min(
            layerRemaining,
            remainingToConsume,
          );

          await tx.costLayer.update({
            where: { id: layer.id },
            data: {
              remainingQuantity: layerRemaining.sub(consumedQuantity),
            },
          });

          await tx.inventoryMovement.create({
            data: {
              tenantId,
              movementType: InventoryMovementType.ISSUE,
              productId: dto.productId,
              warehouseId: dto.warehouseId,
              costLayerId: layer.id,
              quantity: consumedQuantity.mul(new Prisma.Decimal("-1")),
              unitCost: layer.unitCost,
              referenceType: dto.referenceType ?? "INVENTORY_CONSUMPTION",
              referenceId: dto.referenceId ?? null,
              notes: dto.reason?.trim() ?? null,
              performedBy: dto.performedBy?.trim() ?? "system",
              movedAt: new Date(),
            },
          });

          remainingToConsume = remainingToConsume.sub(consumedQuantity);
        }

        await tx.inventoryItem.update({
          where: { id: inventoryItem.id },
          data: {
            quantity: availableQuantity.sub(requestedQuantity),
          },
        });

        return {
          productId: dto.productId,
          warehouseId: dto.warehouseId,
          quantityConsumed: requestedQuantity,
          remainingQuantity: availableQuantity.sub(requestedQuantity),
        };
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
