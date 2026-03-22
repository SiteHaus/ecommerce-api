import { initContract } from "@ts-rest/core";
import { storeContract } from "./store/store.contract.js";
import { variantContract } from "./variants/variants.contract.js";

const c = initContract();

export const contract = c.router({
  store: storeContract,
  variant: variantContract,
});

export { storeContract, variantContract };
