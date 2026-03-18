import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
  ForbiddenException,
} from "@nestjs/common";

@Injectable()
export class StoreOwnerGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest();
    if (!req.user) throw new UnauthorizedException();
    if (!req.store)
      throw new InternalServerErrorException("Store not resolved");
    if (req.store.clientId !== req.user.clientId) {
      throw new ForbiddenException("Not the store owner");
    }
    return true;
  }
}
