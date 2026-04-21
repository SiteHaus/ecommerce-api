import { UseGuards, applyDecorators } from "@nestjs/common";
import { SetMetadata } from "@nestjs/common";
import { CommercePermGuard } from "./commerce-perm.guard";

export const COMMERCE_PERM_KEY = "commercePermRequired";

export const CommercePerm = (permission: string) =>
  applyDecorators(SetMetadata(COMMERCE_PERM_KEY, permission), UseGuards(CommercePermGuard));
