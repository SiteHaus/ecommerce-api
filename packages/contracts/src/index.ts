import { initContract } from "@ts-rest/core";
import { storeContract } from "./store/store.contract.js";

const c = initContract();

export const contract = c.router({
  store: storeContract,
});

export { storeContract };
