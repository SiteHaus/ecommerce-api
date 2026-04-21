import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { COMMERCE_PERM_KEY } from "./commerce-perm.decorator";

@Injectable()
export class CommercePermGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string | undefined>(COMMERCE_PERM_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    if (!required) return true;

    const req = ctx.switchToHttp().getRequest();

    // First-party clients are platform operators — full access
    if (req.user?.clientIsFirstParty) return true;

    if (req.user?.permissions?.includes(required)) return true;

    throw new ForbiddenException("Insufficient permissions");
  }
}
