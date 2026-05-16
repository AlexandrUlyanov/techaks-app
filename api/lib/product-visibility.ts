import { and, eq, sql } from "drizzle-orm";
import { products } from "@db/schema";
import {
  applyProductAutoBlockState,
  AUTO_BLOCK_REASON_ZERO_PRICE,
  hasInvalidProductPrice,
  isProductVisibleOnSite,
  type ProductVisibilitySnapshot,
} from "@contracts/product-visibility";

export {
  applyProductAutoBlockState,
  AUTO_BLOCK_REASON_ZERO_PRICE,
  hasInvalidProductPrice,
  isProductVisibleOnSite,
};

export function buildPublicProductVisibilityCondition() {
  return and(
    eq(products.isActive, true),
    eq(products.isAutoBlocked, false),
    sql`${products.price} > 0`
  );
}

export function getAdminProductPublicationStatus(product: ProductVisibilitySnapshot) {
  if (product.isActive === false) {
    return {
      code: "manual_off",
      label: "Отключен вручную",
      hint: "Администратор отключил отображение товара на сайте.",
    };
  }

  if (
    product.isAutoBlocked === true ||
    product.autoBlockReason === AUTO_BLOCK_REASON_ZERO_PRICE ||
    hasInvalidProductPrice(product.price)
  ) {
    return {
      code: "auto_blocked_zero_price",
      label: "Не отображается на сайте: цена не указана или равна 0",
      hint:
        "После появления цены больше 0 товар появится на сайте только если ручная активность включена.",
    };
  }

  return {
    code: "visible",
    label: "Отображается на сайте",
    hint: "Товар доступен на витрине и может быть куплен.",
  };
}

