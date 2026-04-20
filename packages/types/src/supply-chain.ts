export class InvalidPurchaseOrderTransition extends Error {
  constructor(
    message = "Purchase order cannot move through the requested status transition.",
  ) {
    super(message);
    this.name = "InvalidPurchaseOrderTransition";
  }
}

export class VendorPurchasingBlocked extends Error {
  constructor(
    message = "New purchasing is blocked because the selected vendor is not active.",
  ) {
    super(message);
    this.name = "VendorPurchasingBlocked";
  }
}

export class GoodsReceiptQuantityExceeded extends Error {
  constructor(
    message = "Goods receipt quantity exceeds the remaining quantity on the purchase order.",
  ) {
    super(message);
    this.name = "GoodsReceiptQuantityExceeded";
  }
}

export class InsufficientStockException extends Error {
  constructor(
    message = "Inventory consumption cannot continue because stock is insufficient.",
  ) {
    super(message);
    this.name = "InsufficientStockException";
  }
}

export class MissingReplenishmentConfiguration extends Error {
  constructor(
    message = "Replenishment configuration is missing for the selected product.",
  ) {
    super(message);
    this.name = "MissingReplenishmentConfiguration";
  }
}

export class AmbiguousReplenishmentConfiguration extends Error {
  constructor(
    message = "Multiple active replenishment configurations were found for the selected product.",
  ) {
    super(message);
    this.name = "AmbiguousReplenishmentConfiguration";
  }
}
