import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, Vendor } from "@amdox/db";
import {
  InvalidPurchaseOrderTransition,
  PurchaseOrderStatus,
  VendorPurchasingBlocked,
  VendorStatus,
} from "@amdox/types";
import { ClsService } from "nestjs-cls";
import { PrismaService } from "../prisma/prisma.service";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpsertReplenishmentSettingDto } from "./dto/upsert-replenishment-setting.dto";
import {
  CreatePurchaseOrderDto,
  CreatePurchaseOrderLineDto,
} from "./dto/create-purchase-order.dto";
import { PurchaseOrderQueryDto } from "./dto/purchase-order-query.dto";
import { serializeSupplyChainValue } from "./supply-chain.serialization";

type TenantDb = Prisma.TransactionClient;

type PreparedPurchaseOrderLine = {
  productId: string;
  description: string;
  quantity: Prisma.Decimal;
  unitPrice: bigint;
  receivedQuantity: Prisma.Decimal;
};

@Injectable()
export class SupplyChainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cls: ClsService,
  ) {}

  async createVendor(dto: CreateVendorDto) {
    const tenantId = this.requireTenantId();
    await this.ensureLegalEntityExists(dto.legalEntityId);

    return serializeSupplyChainValue(
      await this.prisma.tenant.vendor.create({
        data: {
          tenantId,
          legalEntityId: dto.legalEntityId,
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
          email: dto.email?.trim().toLowerCase() ?? null,
          phone: dto.phone?.trim() ?? null,
          address: dto.address?.trim() ?? null,
          paymentTerms: dto.paymentTerms ?? 30,
          currency: (dto.currency ?? "INR").trim().toUpperCase(),
          status: dto.status ?? VendorStatus.ACTIVE,
          payablesAccountId: dto.payablesAccountId ?? null,
        },
        include: {
          legalEntity: true,
        },
      }),
    );
  }

  async listVendors() {
    this.requireTenantId();
    return serializeSupplyChainValue(
      await this.prisma.tenant.vendor.findMany({
        where: { deletedAt: null },
        include: {
          legalEntity: true,
        },
        orderBy: [{ name: "asc" }],
      }),
    );
  }

  async updateVendor(id: string, dto: UpdateVendorDto) {
    const vendor = await this.getVendorOrThrow(id);

    return serializeSupplyChainValue(
      await this.prisma.tenant.vendor.update({
        where: { id },
        data: {
          name: dto.name?.trim() ?? vendor.name,
          code: dto.code?.trim().toUpperCase() ?? vendor.code,
          email:
            dto.email === undefined
              ? vendor.email
              : (dto.email?.trim().toLowerCase() ?? null),
          phone:
            dto.phone === undefined
              ? vendor.phone
              : (dto.phone?.trim() ?? null),
          address:
            dto.address === undefined
              ? vendor.address
              : (dto.address?.trim() ?? null),
          paymentTerms: dto.paymentTerms ?? vendor.paymentTerms,
          currency: dto.currency?.trim().toUpperCase() ?? vendor.currency,
          status: dto.status ?? vendor.status,
          payablesAccountId:
            dto.payablesAccountId === undefined
              ? vendor.payablesAccountId
              : dto.payablesAccountId,
        },
        include: {
          legalEntity: true,
        },
      }),
    );
  }

  async createProduct(dto: CreateProductDto) {
    this.requireTenantId();
    return serializeSupplyChainValue(
      await this.prisma.tenant.product.create({
        data: {
          sku: dto.sku.trim().toUpperCase(),
          name: dto.name.trim(),
          description: dto.description?.trim() ?? null,
          category: dto.category?.trim() ?? null,
          unitOfMeasure: (dto.unitOfMeasure ?? "PCS").trim().toUpperCase(),
          reorderPoint: this.toDecimal(dto.reorderPoint),
        },
      }),
    );
  }

  async listProducts() {
    this.requireTenantId();
    return serializeSupplyChainValue(
      await this.prisma.tenant.product.findMany({
        where: { deletedAt: null },
        orderBy: [{ sku: "asc" }],
      }),
    );
  }

  async createWarehouse(dto: CreateWarehouseDto) {
    this.requireTenantId();
    return serializeSupplyChainValue(
      await this.prisma.tenant.warehouse.create({
        data: {
          name: dto.name.trim(),
          code: dto.code.trim().toUpperCase(),
          address: dto.address?.trim() ?? null,
        },
      }),
    );
  }

  async listWarehouses() {
    this.requireTenantId();
    return serializeSupplyChainValue(
      await this.prisma.tenant.warehouse.findMany({
        where: { deletedAt: null },
        orderBy: [{ code: "asc" }],
      }),
    );
  }

  async upsertReplenishmentSetting(
    productId: string,
    dto: UpsertReplenishmentSettingDto,
  ) {
    return serializeSupplyChainValue(
      await this.prisma.$transaction(async (tx) => {
        const tenantId = this.requireTenantId();
        await this.getProductOrThrow(tx, productId);
        await this.getLegalEntityOrThrow(tx, dto.legalEntityId);
        const vendor = await this.getVendorOrThrow(dto.vendorId, tx);
        this.assertVendorPurchasable(vendor);

        const where = {
          tenantId_productId_legalEntityId: {
            tenantId,
            productId,
            legalEntityId: dto.legalEntityId,
          },
        };

        await tx.productReplenishmentSetting.upsert({
          where,
          create: {
            tenantId,
            productId,
            legalEntityId: dto.legalEntityId,
            vendorId: dto.vendorId,
            reorderQuantity: this.toDecimal(dto.reorderQuantity),
            isAutoReorderEnabled: dto.isAutoReorderEnabled ?? true,
          },
          update: {
            vendorId: dto.vendorId,
            reorderQuantity: this.toDecimal(dto.reorderQuantity),
            isAutoReorderEnabled: dto.isAutoReorderEnabled ?? true,
          },
        });

        return tx.productReplenishmentSetting.findUnique({
          where,
          include: {
            product: true,
            vendor: true,
            legalEntity: true,
          },
        });
      }),
    );
  }

  async getReplenishmentSettings(productId: string) {
    this.requireTenantId();
    return serializeSupplyChainValue(
      await this.prisma.tenant.productReplenishmentSetting.findMany({
        where: {
          deletedAt: null,
          productId,
        },
        include: {
          product: true,
          vendor: true,
          legalEntity: true,
        },
        orderBy: [{ legalEntityId: "asc" }],
      }),
    );
  }

  async createPurchaseOrder(dto: CreatePurchaseOrderDto, createdBy?: string) {
    return serializeSupplyChainValue(
      await this.prisma.$transaction(async (tx) => {
        const tenantId = this.requireTenantId();
        await this.getLegalEntityOrThrow(tx, dto.legalEntityId);
        const vendor = await this.getVendorOrThrow(dto.vendorId, tx);
        this.assertVendorPurchasable(vendor);

        if (vendor.legalEntityId !== dto.legalEntityId) {
          throw new BadRequestException(
            "Vendor must belong to the same legal entity as the purchase order.",
          );
        }

        const preparedLines = await this.preparePurchaseOrderLines(
          tx,
          dto.lines,
        );
        const purchaseOrder = await tx.purchaseOrder.create({
          data: {
            tenantId,
            poNumber: this.createPurchaseOrderNumber(),
            vendorId: dto.vendorId,
            legalEntityId: dto.legalEntityId,
            status: PurchaseOrderStatus.DRAFT,
            totalAmount: this.calculatePurchaseOrderTotal(preparedLines),
            currency: (dto.currency ?? vendor.currency ?? "INR")
              .trim()
              .toUpperCase(),
            expectedDelivery: dto.expectedDelivery
              ? new Date(dto.expectedDelivery)
              : null,
            approvedBy: createdBy ?? null,
          },
        });

        await tx.purchaseOrderLine.createMany({
          data: preparedLines.map((line) => ({
            tenantId,
            purchaseOrderId: purchaseOrder.id,
            productId: line.productId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            receivedQuantity: line.receivedQuantity,
          })),
        });

        return tx.purchaseOrder.findFirst({
          where: {
            id: purchaseOrder.id,
            tenantId,
            deletedAt: null,
          },
          include: {
            vendor: true,
            legalEntity: true,
            lines: {
              include: {
                product: true,
              },
            },
          },
        });
      }),
    );
  }

  async listPurchaseOrders(query: PurchaseOrderQueryDto) {
    this.requireTenantId();
    return serializeSupplyChainValue(
      await this.prisma.tenant.purchaseOrder.findMany({
        where: {
          deletedAt: null,
          vendorId: query.vendorId,
          legalEntityId: query.legalEntityId,
          status: query.status,
        },
        include: {
          vendor: true,
          legalEntity: true,
          lines: {
            include: {
              product: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
    );
  }

  async getPurchaseOrder(id: string) {
    const purchaseOrder = await this.prisma.tenant.purchaseOrder.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        vendor: true,
        legalEntity: true,
        lines: {
          include: {
            product: true,
          },
        },
        goodsReceipts: {
          include: {
            warehouse: true,
            lines: true,
          },
        },
      },
    });

    if (!purchaseOrder) {
      throw new NotFoundException("Purchase order not found.");
    }

    return serializeSupplyChainValue(purchaseOrder);
  }

  async replacePurchaseOrderLines(
    id: string,
    lines: CreatePurchaseOrderLineDto[],
  ) {
    return serializeSupplyChainValue(
      await this.prisma.$transaction(async (tx) => {
        const purchaseOrder = await this.getPurchaseOrderOrThrow(tx, id);
        this.assertDraftEditable(purchaseOrder.status);

        const preparedLines = await this.preparePurchaseOrderLines(tx, lines);
        await tx.purchaseOrderLine.deleteMany({
          where: {
            purchaseOrderId: id,
            tenantId: purchaseOrder.tenantId,
          },
        });
        await tx.purchaseOrderLine.createMany({
          data: preparedLines.map((line) => ({
            tenantId: purchaseOrder.tenantId,
            purchaseOrderId: purchaseOrder.id,
            productId: line.productId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            receivedQuantity: line.receivedQuantity,
          })),
        });
        await tx.purchaseOrder.update({
          where: { id },
          data: {
            totalAmount: this.calculatePurchaseOrderTotal(preparedLines),
          },
        });

        return tx.purchaseOrder.findFirst({
          where: {
            id,
            tenantId: purchaseOrder.tenantId,
            deletedAt: null,
          },
          include: {
            vendor: true,
            legalEntity: true,
            lines: {
              include: {
                product: true,
              },
            },
          },
        });
      }),
    );
  }

  async submitPurchaseOrder(id: string, submittedBy?: string) {
    return serializeSupplyChainValue(
      await this.transitionPurchaseOrder(id, (purchaseOrder, tx) => {
        if (purchaseOrder.status !== PurchaseOrderStatus.DRAFT) {
          throw new InvalidPurchaseOrderTransition(
            "Only draft purchase orders can be submitted.",
          );
        }

        return tx.purchaseOrder.update({
          where: { id },
          data: {
            status: PurchaseOrderStatus.SUBMITTED,
            submittedAt: new Date(),
            approvedBy: submittedBy ?? purchaseOrder.approvedBy,
          },
        });
      }),
    );
  }

  async approvePurchaseOrder(id: string, approvedBy?: string) {
    return serializeSupplyChainValue(
      await this.transitionPurchaseOrder(id, (purchaseOrder, tx) => {
        if (purchaseOrder.status !== PurchaseOrderStatus.SUBMITTED) {
          throw new InvalidPurchaseOrderTransition(
            "Only submitted purchase orders can be approved.",
          );
        }

        return tx.purchaseOrder.update({
          where: { id },
          data: {
            status: PurchaseOrderStatus.APPROVED,
            approvedAt: new Date(),
            approvedBy: approvedBy ?? "system",
          },
        });
      }),
    );
  }

  async rejectPurchaseOrder(id: string, reason?: string, _rejectedBy?: string) {
    return serializeSupplyChainValue(
      await this.transitionPurchaseOrder(id, (purchaseOrder, tx) => {
        if (purchaseOrder.status !== PurchaseOrderStatus.SUBMITTED) {
          throw new InvalidPurchaseOrderTransition(
            "Only submitted purchase orders can be rejected.",
          );
        }

        return tx.purchaseOrder.update({
          where: { id },
          data: {
            status: PurchaseOrderStatus.REJECTED,
            rejectedAt: new Date(),
            rejectedReason: reason?.trim() ?? null,
          },
        });
      }),
    );
  }

  async returnRejectedPurchaseOrderToDraft(id: string) {
    return serializeSupplyChainValue(
      await this.transitionPurchaseOrder(id, (purchaseOrder, tx) => {
        if (purchaseOrder.status !== PurchaseOrderStatus.REJECTED) {
          throw new InvalidPurchaseOrderTransition(
            "Only rejected purchase orders can return to draft.",
          );
        }

        return tx.purchaseOrder.update({
          where: { id },
          data: {
            status: PurchaseOrderStatus.DRAFT,
          },
        });
      }),
    );
  }

  async sendPurchaseOrderToVendor(id: string, _sentBy?: string) {
    return serializeSupplyChainValue(
      await this.transitionPurchaseOrder(id, (purchaseOrder, tx) => {
        if (purchaseOrder.status !== PurchaseOrderStatus.APPROVED) {
          throw new InvalidPurchaseOrderTransition(
            "Only approved purchase orders can be sent to vendors.",
          );
        }

        return tx.purchaseOrder.update({
          where: { id },
          data: {
            status: PurchaseOrderStatus.SENT_TO_VENDOR,
            sentToVendorAt: new Date(),
          },
        });
      }),
    );
  }

  private async transitionPurchaseOrder(
    id: string,
    mutate: (
      purchaseOrder: Awaited<
        ReturnType<SupplyChainService["getPurchaseOrderOrThrow"]>
      >,
      tx: TenantDb,
    ) => Promise<unknown>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const purchaseOrder = await this.getPurchaseOrderOrThrow(tx, id);
      await mutate(purchaseOrder, tx);

      return tx.purchaseOrder.findFirst({
        where: {
          id,
          tenantId: purchaseOrder.tenantId,
          deletedAt: null,
        },
        include: {
          vendor: true,
          legalEntity: true,
          lines: {
            include: {
              product: true,
            },
          },
        },
      });
    });
  }

  private async preparePurchaseOrderLines(
    tx: TenantDb,
    lines: CreatePurchaseOrderLineDto[],
  ) {
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const products = await tx.product.findMany({
      where: {
        tenantId: this.requireTenantId(),
        deletedAt: null,
        id: {
          in: productIds,
        },
      },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException("One or more products could not be found.");
    }

    return lines.map((line) => ({
      productId: line.productId,
      description: line.description.trim(),
      quantity: this.toDecimal(line.quantity),
      unitPrice: BigInt(line.unitPrice),
      receivedQuantity: new Prisma.Decimal("0"),
    })) satisfies PreparedPurchaseOrderLine[];
  }

  private calculatePurchaseOrderTotal(lines: PreparedPurchaseOrderLine[]) {
    return lines.reduce((sum, line) => {
      const lineTotal = line.quantity
        .mul(new Prisma.Decimal(line.unitPrice.toString()))
        .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
      return sum + BigInt(lineTotal.toString());
    }, 0n);
  }

  private async ensureLegalEntityExists(legalEntityId: string) {
    const legalEntity = await this.prisma.tenant.legalEntity.findFirst({
      where: {
        id: legalEntityId,
        deletedAt: null,
      },
    });
    if (!legalEntity) {
      throw new NotFoundException("Legal entity not found.");
    }
    return legalEntity;
  }

  private async getLegalEntityOrThrow(tx: TenantDb, legalEntityId: string) {
    const legalEntity = await tx.legalEntity.findFirst({
      where: {
        id: legalEntityId,
        tenantId: this.requireTenantId(),
        deletedAt: null,
      },
    });
    if (!legalEntity) {
      throw new NotFoundException("Legal entity not found.");
    }
    return legalEntity;
  }

  private async getProductOrThrow(tx: TenantDb, productId: string) {
    const product = await tx.product.findFirst({
      where: {
        id: productId,
        tenantId: this.requireTenantId(),
        deletedAt: null,
      },
    });
    if (!product) {
      throw new NotFoundException("Product not found.");
    }
    return product;
  }

  private async getVendorOrThrow(id: string, tx?: TenantDb) {
    const db = tx ?? this.prisma.tenant;
    const vendor = await db.vendor.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    });
    if (!vendor) {
      throw new NotFoundException("Vendor not found.");
    }
    return vendor;
  }

  private async getPurchaseOrderOrThrow(tx: TenantDb, id: string) {
    const purchaseOrder = await tx.purchaseOrder.findFirst({
      where: {
        id,
        tenantId: this.requireTenantId(),
        deletedAt: null,
      },
      include: {
        vendor: true,
        legalEntity: true,
        lines: true,
      },
    });
    if (!purchaseOrder) {
      throw new NotFoundException("Purchase order not found.");
    }
    return purchaseOrder;
  }

  private assertVendorPurchasable(vendor: Vendor) {
    if (vendor.status === VendorStatus.ACTIVE) {
      return;
    }

    throw new VendorPurchasingBlocked(
      "New purchasing is blocked for inactive or blacklisted vendors.",
    );
  }

  private assertDraftEditable(status: string) {
    if (status !== PurchaseOrderStatus.DRAFT) {
      throw new InvalidPurchaseOrderTransition(
        "Material purchase order edits are only allowed while the order is in draft.",
      );
    }
  }

  private createPurchaseOrderNumber() {
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `PO-${stamp}-${suffix}`;
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
