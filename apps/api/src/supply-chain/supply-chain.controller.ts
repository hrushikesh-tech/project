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
import { SupplyChainService } from "./supply-chain.service";
import { GoodsReceiptService } from "./receiving/goods-receipt.service";
import { FifoInventoryService } from "./inventory/fifo-inventory.service";
import { CreateVendorDto } from "./dto/create-vendor.dto";
import { UpdateVendorDto } from "./dto/update-vendor.dto";
import { CreateProductDto } from "./dto/create-product.dto";
import { CreateWarehouseDto } from "./dto/create-warehouse.dto";
import { UpsertReplenishmentSettingDto } from "./dto/upsert-replenishment-setting.dto";
import { CreatePurchaseOrderDto } from "./dto/create-purchase-order.dto";
import { PurchaseOrderQueryDto } from "./dto/purchase-order-query.dto";
import { TransitionPurchaseOrderDto } from "./dto/transition-purchase-order.dto";
import { CreateGoodsReceiptDto } from "./dto/create-goods-receipt.dto";
import { ConsumeInventoryDto } from "./dto/consume-inventory.dto";
import { EntityIdPipe } from "../common/validation/entity-id.pipe";

type RequestUser = { userId?: string; roles?: string[] };

@ApiTags("supply-chain")
@Controller({ path: "supply-chain", version: "1" })
export class SupplyChainController {
  constructor(
    private readonly supplyChainService: SupplyChainService,
    private readonly goodsReceiptService: GoodsReceiptService,
    private readonly fifoInventoryService: FifoInventoryService,
  ) {}

  @Post("vendors")
  @Roles("supply_chain_manager", "tenant_admin")
  createVendor(@Body() dto: CreateVendorDto) {
    return this.supplyChainService.createVendor(dto);
  }

  @Get("vendors")
  @Roles("supply_chain_manager", "tenant_admin", "viewer")
  listVendors() {
    return this.supplyChainService.listVendors();
  }

  @Patch("vendors/:id")
  @Roles("supply_chain_manager", "tenant_admin")
  updateVendor(@Param("id", EntityIdPipe) id: string, @Body() dto: UpdateVendorDto) {
    return this.supplyChainService.updateVendor(id, dto);
  }

  @Post("products")
  @Roles("supply_chain_manager", "tenant_admin")
  createProduct(@Body() dto: CreateProductDto) {
    return this.supplyChainService.createProduct(dto);
  }

  @Get("products")
  @Roles("supply_chain_manager", "tenant_admin", "viewer")
  listProducts() {
    return this.supplyChainService.listProducts();
  }

  @Post("warehouses")
  @Roles("supply_chain_manager", "tenant_admin")
  createWarehouse(@Body() dto: CreateWarehouseDto) {
    return this.supplyChainService.createWarehouse(dto);
  }

  @Get("warehouses")
  @Roles("supply_chain_manager", "tenant_admin", "viewer")
  listWarehouses() {
    return this.supplyChainService.listWarehouses();
  }

  @Put("products/:id/replenishment")
  @Roles("supply_chain_manager", "tenant_admin")
  upsertReplenishmentSetting(
    @Param("id", EntityIdPipe) productId: string,
    @Body() dto: UpsertReplenishmentSettingDto,
  ) {
    return this.supplyChainService.upsertReplenishmentSetting(productId, dto);
  }

  @Get("products/:id/replenishment")
  @Roles("supply_chain_manager", "tenant_admin", "viewer")
  getReplenishmentSetting(@Param("id", EntityIdPipe) productId: string) {
    return this.supplyChainService.getReplenishmentSettings(productId);
  }

  @Post("purchase-orders")
  @Roles("supply_chain_manager", "tenant_admin")
  createPurchaseOrder(
    @Body() dto: CreatePurchaseOrderDto,
    @Req() request: { user?: RequestUser },
  ) {
    return this.supplyChainService.createPurchaseOrder(
      dto,
      request.user?.userId,
    );
  }

  @Get("purchase-orders")
  @Roles("supply_chain_manager", "tenant_admin", "viewer")
  listPurchaseOrders(@Query() query: PurchaseOrderQueryDto) {
    return this.supplyChainService.listPurchaseOrders(query);
  }

  @Get("purchase-orders/:id")
  @Roles("supply_chain_manager", "tenant_admin", "viewer")
  getPurchaseOrder(@Param("id", EntityIdPipe) id: string) {
    return this.supplyChainService.getPurchaseOrder(id);
  }

  @Post("purchase-orders/:id/submit")
  @Roles("supply_chain_manager", "tenant_admin")
  submitPurchaseOrder(
    @Param("id", EntityIdPipe) id: string,
    @Req() request: { user?: RequestUser },
  ) {
    return this.supplyChainService.submitPurchaseOrder(
      id,
      request.user?.userId,
    );
  }

  @Post("purchase-orders/:id/approve")
  @Roles("supply_chain_manager", "tenant_admin")
  approvePurchaseOrder(
    @Param("id", EntityIdPipe) id: string,
    @Req() request: { user?: RequestUser },
  ) {
    return this.supplyChainService.approvePurchaseOrder(
      id,
      request.user?.userId,
    );
  }

  @Post("purchase-orders/:id/reject")
  @Roles("supply_chain_manager", "tenant_admin")
  rejectPurchaseOrder(
    @Param("id", EntityIdPipe) id: string,
    @Body() dto: TransitionPurchaseOrderDto,
    @Req() request: { user?: RequestUser },
  ) {
    return this.supplyChainService.rejectPurchaseOrder(
      id,
      dto.reason,
      request.user?.userId,
    );
  }

  @Post("purchase-orders/:id/return-to-draft")
  @Roles("supply_chain_manager", "tenant_admin")
  returnRejectedPurchaseOrderToDraft(@Param("id", EntityIdPipe) id: string) {
    return this.supplyChainService.returnRejectedPurchaseOrderToDraft(id);
  }

  @Post("purchase-orders/:id/send")
  @Roles("supply_chain_manager", "tenant_admin")
  sendPurchaseOrder(
    @Param("id", EntityIdPipe) id: string,
    @Req() request: { user?: RequestUser },
  ) {
    return this.supplyChainService.sendPurchaseOrderToVendor(
      id,
      request.user?.userId,
    );
  }

  @Post("goods-receipts")
  @Roles("supply_chain_manager", "tenant_admin")
  createGoodsReceipt(@Body() dto: CreateGoodsReceiptDto) {
    return this.goodsReceiptService.createGoodsReceipt(dto);
  }

  @Post("inventory/consume")
  @Roles("supply_chain_manager", "tenant_admin")
  consumeInventory(@Body() dto: ConsumeInventoryDto) {
    return this.fifoInventoryService.consumeInventory(dto);
  }
}
