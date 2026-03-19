import { Controller, Req, UseGuards } from '@nestjs/common';
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest';
import { StoreOwnerGuard } from '@sitehaus-ecom/auth';
import { contract } from '@sitehaus-ecom/contracts';
import type { Request } from 'express';
import { StoreService } from './store.service';

@Controller()
export class StoreAdminController {
  constructor(private readonly storeService: StoreService) {}

  @TsRestHandler(contract.store.getMe)
  async getMe(@Req() req: Request) {
    return tsRestHandler(contract.store.getMe, async () => {
      const store = req.store;
      if (!store) return { status: 404 as const, body: { message: 'Store not found' } };
      return { status: 200 as const, body: store };
    });
  }

  @TsRestHandler(contract.store.create)
  async create(@Req() req: Request) {
    return tsRestHandler(contract.store.create, async ({ body }) => {
      try {
        const store = await this.storeService.create(req.user!.clientId, body);
        return { status: 201 as const, body: store };
      } catch (err: any) {
        if (err?.code === '23505') {
          return {
            status: 409 as const,
            body: {
              message:
                err.constraint === 'stores_slug_uq'
                  ? 'Slug already taken'
                  : 'Domain already taken',
            },
          };
        }
        throw err;
      }
    });
  }

  @UseGuards(StoreOwnerGuard)
  @TsRestHandler(contract.store.update)
  async update(@Req() req: Request) {
    return tsRestHandler(contract.store.update, async ({ body }) => {
      const store = req.store!;
      try {
        const result = await this.storeService.update(
          store.id,
          store.slug,
          store.domain,
          body,
        );
        return { status: 200 as const, body: result };
      } catch (err: any) {
        if (err?.code === '23505') {
          return {
            status: 409 as const,
            body: {
              message:
                err.constraint === 'stores_slug_uq'
                  ? 'Slug already taken'
                  : 'Domain already taken',
            },
          };
        }
        throw err;
      }
    });
  }
}
