import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import {
  AmbiguousReplenishmentConfiguration,
  GoodsReceiptQuantityExceeded,
  InsufficientStockException,
  InvalidPurchaseOrderTransition,
  MissingReplenishmentConfiguration,
  VendorPurchasingBlocked,
} from "@amdox/types";
import { writeApiErrorResponse } from "../common/api/request-context";

@Catch(
  AmbiguousReplenishmentConfiguration,
  GoodsReceiptQuantityExceeded,
  InsufficientStockException,
  InvalidPurchaseOrderTransition,
  MissingReplenishmentConfiguration,
  VendorPurchasingBlocked,
)
export class SupplyChainExceptionFilter implements ExceptionFilter {
  catch(exception: Error, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse();
    const request = host.switchToHttp().getRequest();

    return writeApiErrorResponse(response, request, HttpStatus.CONFLICT, {
      code: exception.name,
      message: exception.message,
    });
  }
}
