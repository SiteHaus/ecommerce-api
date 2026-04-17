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
 * Prefers the x-client-id header (sent by the commerce admin frontend via
 * targetClientIdProvider) so the frontend never needs to switch OAuth clients.
 * The requested client ID is validated against the user's accessible clients
 * (from introspection) before use.
 *
 * Falls back to req.user.clientId for tokens issued directly for a merchant
 * client (legacy / storefront-initiated sessions).
 */
@Injectable()
export class AdminStoreGuard implements CanActivate {
  constructor(private readonly storeService: StoreService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) throw new UnauthorizedException();

    const requestedClientId = req.headers["x-client-id"] as string | undefined;

    const clientId =
      requestedClientId && req.user.accessibleClientIds?.includes(requestedClientId)
        ? requestedClientId
        : req.user.clientId;

    if (requestedClientId && !req.user.accessibleClientIds?.includes(requestedClientId)) {
      throw new ForbiddenException("You do not have access to this store");
    }

    const store = await this.storeService.findByClientId(clientId);
    if (!store) throw new NotFoundException("Store not found");

    req.store = store;
    return true;
  }
}
