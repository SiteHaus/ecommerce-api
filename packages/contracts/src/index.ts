import { initContract } from "@ts-rest/core";
import { cartContract } from "./cart/cart.contract.js";
import { inventoryContract } from "./inventory/inventory.contract.js";
import { storeContract } from "./store/store.contract.js";
import { variantContract } from "./variants/variants.contract.js";

const c = initContract();

export const contract = c.router({
  cart: cartContract,
  inventory: inventoryContract,
  store: storeContract,
  variant: variantContract,
});

export { cartContract, inventoryContract, storeContract, variantContract };
