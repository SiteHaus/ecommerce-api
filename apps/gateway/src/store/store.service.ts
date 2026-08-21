import { Inject, Injectable } from "@nestjs/common";
import type { ResolvedStore } from "@sitehaus-ecom/auth";
import { and, eq, inArray, storesTable, type Db } from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import type { CreateStoreDto, UpdateStoreDto } from "@sitehaus-ecom/validation";
import type { Redis } from "ioredis";

export const REDIS_TOKEN = "STORE_REDIS";

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

  async findByClientIds(
    clientIds: string[],
  ): Promise<{ id: string; clientId: string; slug: string; name: string }[]> {
    if (clientIds.length === 0) return [];
    const rows = await this.db
      .select({
        id: storesTable.id,
        clientId: storesTable.clientId,
        slug: storesTable.slug,
        name: storesTable.name,
      })
      .from(storesTable)
      .where(and(inArray(storesTable.clientId, clientIds), eq(storesTable.isActive, true)));
    return rows;
  }

  /**
   * CORS support: true when `origin`'s host matches an active store domain.
   * Backed by the Redis-cached `findByDomain`, so the allow-list tracks live
   * store domains without a stale startup snapshot.
   */
  async isActiveStoreOrigin(origin: string): Promise<boolean> {
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      return false;
    }
    const store = await this.findByDomain(host);
    return store !== null;
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
        ...(dto.notificationEmail !== undefined && { notificationEmail: dto.notificationEmail }),
        ...(dto.notificationPreferences !== undefined && {
          notificationPreferences: dto.notificationPreferences,
        }),
        ...(dto.reservationTtlMinutes !== undefined && {
          reservationTtlMinutes: dto.reservationTtlMinutes,
        }),
        ...(dto.fulfillmentType !== undefined && { fulfillmentType: dto.fulfillmentType }),
        ...(dto.taxRegistrationConfirmed !== undefined && {
          taxRegistrationConfirmed: dto.taxRegistrationConfirmed,
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
    notificationEmail: row.notificationEmail,
    notificationPreferences: row.notificationPreferences ?? null,
    stripeAccountId: row.stripeAccountId,
    stripeChargesEnabled: row.stripeChargesEnabled,
    stripePayoutsEnabled: row.stripePayoutsEnabled,
    stripeDetailsSubmitted: row.stripeDetailsSubmitted,
    reservationTtlMinutes: row.reservationTtlMinutes,
    fulfillmentType: row.fulfillmentType,
    taxRegistrationConfirmed: row.taxRegistrationConfirmed,
  };
}
