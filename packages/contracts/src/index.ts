import { initContract } from "@ts-rest/core";
import { cartContract } from "./cart/cart.contract.js";
import { checkoutContract } from "./checkout/checkout.contract.js";
import { inventoryContract } from "./inventory/inventory.contract.js";
import { productContract } from "./product/product.contract.js";
import { storeContract } from "./store/store.contract.js";
import { variantContract } from "./variants/variants.contract.js";
import { collectionContract } from "./collection/collection.contract.js";

const c = initContract();

export const contract = c.router({
  cart: cartContract,
  checkout: checkoutContract,
  inventory: inventoryContract,
  product: productContract,
  store: storeContract,
  variant: variantContract,
  collection: collectionContract,
});

export {
  cartContract,
  checkoutContract,
  inventoryContract,
  productContract,
  storeContract,
  variantContract,
  collectionContract
};
