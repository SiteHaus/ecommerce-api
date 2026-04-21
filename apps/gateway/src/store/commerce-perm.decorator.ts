import { SetMetadata } from "@nestjs/common";

export const COMMERCE_PERM_KEY = "commercePermRequired";

export const CommercePerm = (permission: string) => SetMetadata(COMMERCE_PERM_KEY, permission);
