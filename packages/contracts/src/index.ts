import { initContract } from "@ts-rest/core";
import { cartContract } from "./cart/cart.contract.js";
import { checkoutContract } from "./checkout/checkout.contract.js";
import { inventoryContract } from "./inventory/inventory.contract.js";
import { storeContract } from "./store/store.contract.js";
import { variantContract } from "./variants/variants.contract.js";

const c = initContract();

export const contract = c.router({
  cart: cartContract,
  checkout: checkoutContract,
  inventory: inventoryContract,
  store: storeContract,
  variant: variantContract,
});

export { cartContract, checkoutContract, inventoryContract, storeContract, variantContract };
