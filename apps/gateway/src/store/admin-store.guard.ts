import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { StoreService } from "./store.service";

/**
 * For admin routes — resolves req.store directly from the authenticated user's
 * clientId rather than relying on the StoreResolutionMiddleware.
 *
 * This means admin routes work correctly regardless of hostname or slug in the
 * URL, and the store discovery endpoints (getAccessible, getMe) don't need to
 * be excluded from middleware.
 */
@Injectable()
export class AdminStoreGuard implements CanActivate {
  constructor(private readonly storeService: StoreService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) throw new UnauthorizedException();

    const store = await this.storeService.findByClientId(req.user.clientId);
    if (!store) throw new NotFoundException("Store not found");

    req.store = store;
    return true;
  }
}
