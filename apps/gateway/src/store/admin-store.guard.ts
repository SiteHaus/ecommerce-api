import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { StoreService } from "./store.service";

/**
 * For admin routes — resolves req.store from the authenticated user's context.
 *
 * First-party clients (SiteHaus internal, e.g. sitehaus-commerce-admin) may
 * pass x-client-id to specify which store to operate on. This avoids the need
 * for a separate OAuth re-auth flow per merchant store.
 *
 * Non-first-party clients (merchant tokens) may only operate on their own
 * store (x-client-id must match their token's clientId, or be absent).
 *
 * Falls back to req.user.clientId when no x-client-id header is present.
 */
@Injectable()
export class AdminStoreGuard implements CanActivate {
  constructor(private readonly storeService: StoreService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) throw new UnauthorizedException();

    const requestedClientId = req.headers["x-client-id"] as string | undefined;

    if (requestedClientId) {
      const isSelf = requestedClientId === req.user.clientId;
      if (!req.user.clientIsFirstParty && !isSelf) {
        throw new ForbiddenException("You do not have access to this store");
      }
    }

    const clientId = requestedClientId ?? req.user.clientId;

    const store = await this.storeService.findByClientId(clientId);
    if (!store) throw new NotFoundException("Store not found");

    req.store = store;
    return true;
  }
}
