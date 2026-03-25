import { initContract } from "@ts-rest/core";
import { cartContract } from "./cart/cart.contract.js";
import { checkoutContract } from "./checkout/checkout.contract.js";
import { inventoryContract } from "./inventory/inventory.contract.js";
import { ordersContract } from "./orders/orders.contract.js";
import { productContract } from "./product/product.contract.js";
import { storeContract } from "./store/store.contract.js";
import { variantContract } from "./variants/variants.contract.js";
import { imagesContract } from "./product-images/product-images.contract.js";

const c = initContract();

export const contract = c.router({
  cart: cartContract,
  checkout: checkoutContract,
  inventory: inventoryContract,
  orders: ordersContract,
  product: productContract,
  store: storeContract,
  variant: variantContract,
  image: imagesContract,
});

export {
  cartContract,
  checkoutContract,
  inventoryContract,
  ordersContract,
  productContract,
  storeContract,
  variantContract,
  imagesContract,
};
