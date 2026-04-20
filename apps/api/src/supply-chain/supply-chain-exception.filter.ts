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

    response.status(HttpStatus.CONFLICT).json({
      statusCode: HttpStatus.CONFLICT,
      error: exception.name,
      message: exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
