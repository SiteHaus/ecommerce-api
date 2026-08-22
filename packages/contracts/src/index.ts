import { initContract } from "@ts-rest/core";
import { analyticsContract } from "./analytics/analytics.contract.js";
import { cartContract } from "./cart/cart.contract.js";
import { checkoutContract } from "./checkout/checkout.contract.js";
import { discountContract } from "./discounts/discounts.contract.js";
import { inventoryContract } from "./inventory/inventory.contract.js";
import { optionsContract } from "./options/options.contract.js";
import { ordersContract } from "./orders/orders.contract.js";
import { productContract } from "./product/product.contract.js";
import { storeContract } from "./store/store.contract.js";
import { variantContract } from "./variants/variants.contract.js";
import { imagesContract } from "./product-images/product-images.contract.js";
import { collectionContract } from "./collection/collection.contract.js";
import { shippingContract } from "./shipping/shipping.contract.js";
import { labelsContract } from "./shipping/labels.contract.js";
import { customersContract } from "./customers/customers.contract.js";
import { returnsContract } from "./returns/returns.contract.js";
import { webhooksContract } from "./webhooks/webhooks.contract.js";
const c = initContract();

export const contract = c.router({
  analytics: analyticsContract,
  cart: cartContract,
  checkout: checkoutContract,
  customer: customersContract,
  returns: returnsContract,
  discount: discountContract,
  inventory: inventoryContract,
  options: optionsContract,
  orders: ordersContract,
  product: productContract,
  store: storeContract,
  variant: variantContract,
  image: imagesContract,
  collection: collectionContract,
  shipping: shippingContract,
  labels: labelsContract,
  webhooks: webhooksContract,
});

export {
  analyticsContract,
  cartContract,
  checkoutContract,
  customersContract,
  returnsContract,
  discountContract,
  inventoryContract,
  optionsContract,
  ordersContract,
  productContract,
  storeContract,
  variantContract,
  imagesContract,
  collectionContract,
  shippingContract,
  labelsContract,
  webhooksContract,
};
