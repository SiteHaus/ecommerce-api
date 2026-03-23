import { initContract } from "@ts-rest/core";
import { storeContract } from "./store/store.contract.js";
import { variantContract } from "./variants/variants.contract.js";
import { productContract } from "./product/product.contract.js";

const c = initContract();

export const contract = c.router({
  store: storeContract,
  variant: variantContract,
  product: productContract,
});

export { storeContract, variantContract, productContract };
