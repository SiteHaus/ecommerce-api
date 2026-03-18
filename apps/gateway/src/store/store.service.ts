import { Inject, Injectable } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { DB_TOKEN } from '@sitehaus-ecom/shared';
import { storesTable, eq, and, type Db } from '@sitehaus-ecom/database';
import type { ResolvedStore } from '@sitehaus-ecom/auth';
import type { CreateStoreDto, UpdateStoreDto } from '@sitehaus-ecom/validation';

export const REDIS_TOKEN = 'STORE_REDIS';

const CACHE_TTL = 60; // seconds

@Injectable()
export class StoreService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    @Inject(REDIS_TOKEN) private readonly redis: Redis,
  ) {}

  async findByDomain(domain: string): Promise<ResolvedStore | null> {
    const key = `store:domain:${domain}`;
    const hit = await this.redis.get(key);
    if (hit) return JSON.parse(hit) as ResolvedStore;

    const [row] = await this.db
      .select()
      .from(storesTable)
      .where(and(eq(storesTable.domain, domain), eq(storesTable.isActive, true)))
      .limit(1);

    if (!row) return null;
    const ctx = toContext(row);
    await this.redis.setex(key, CACHE_TTL, JSON.stringify(ctx));
    return ctx;
  }

  async findBySlug(slug: string): Promise<ResolvedStore | null> {
    const key = `store:slug:${slug}`;
    const hit = await this.redis.get(key);
    if (hit) return JSON.parse(hit) as ResolvedStore;

    const [row] = await this.db
      .select()
      .from(storesTable)
      .where(and(eq(storesTable.slug, slug), eq(storesTable.isActive, true)))
      .limit(1);

    if (!row) return null;
    const ctx = toContext(row);
    await this.redis.setex(key, CACHE_TTL, JSON.stringify(ctx));
    return ctx;
  }

  async findByClientId(clientId: string): Promise<ResolvedStore | null> {
    const [row] = await this.db
      .select()
      .from(storesTable)
      .where(and(eq(storesTable.clientId, clientId), eq(storesTable.isActive, true)))
      .limit(1);

    return row ? toContext(row) : null;
  }

  async create(clientId: string, dto: CreateStoreDto): Promise<ResolvedStore> {
    const [row] = await this.db
      .insert(storesTable)
      .values({
        clientId,
        name: dto.name,
        slug: dto.slug,
        domain: dto.domain,
        currency: dto.currency,
        timezone: dto.timezone,
      })
      .returning();
    return toContext(row);
  }

  async update(
    storeId: string,
    currentSlug: string,
    currentDomain: string | null,
    dto: UpdateStoreDto,
  ): Promise<ResolvedStore> {
    // Invalidate before saving, per spec
    await this.invalidateCache(currentSlug, currentDomain);

    const [row] = await this.db
      .update(storesTable)
      .set({
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.slug !== undefined && { slug: dto.slug }),
        ...(dto.domain !== undefined && { domain: dto.domain }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.reservationTtlMinutes !== undefined && {
          reservationTtlMinutes: dto.reservationTtlMinutes,
        }),
      })
      .where(eq(storesTable.id, storeId))
      .returning();

    return toContext(row);
  }

  async invalidateCache(slug: string, domain: string | null): Promise<void> {
    const keys = [`store:slug:${slug}`];
    if (domain) keys.push(`store:domain:${domain}`);
    await this.redis.del(...keys);
  }
}

function toContext(row: typeof storesTable.$inferSelect): ResolvedStore {
  return {
    id: row.id,
    clientId: row.clientId,
    slug: row.slug,
    domain: row.domain,
    currency: row.currency,
    stripeAccountId: row.stripeAccountId,
    stripeChargesEnabled: row.stripeChargesEnabled,
    stripePayoutsEnabled: row.stripePayoutsEnabled,
    stripeDetailsSubmitted: row.stripeDetailsSubmitted,
    reservationTtlMinutes: row.reservationTtlMinutes,
  };
}
