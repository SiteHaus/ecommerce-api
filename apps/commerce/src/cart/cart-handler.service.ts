import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  and,
  cartItemsTable,
  cartsTable,
  Db,
  eq,
  inArray,
  inventoryTable,
  productImagesTable,
  productsTable,
  productVariantsTable,
  sql,
} from "@sitehaus-ecom/database";

import { DB_TOKEN } from "@sitehaus-ecom/shared";

type CartIdentity = { storeId: string; sessionToken?: string; userId?: string };
type Availability = "in_stock" | "low_stock" | "out_of_stock";

function toAvailability(stock: number, reserved: number, allowBackorder: boolean): Availability {
  if (allowBackorder) return "in_stock";
  const available = stock - reserved;
  if (available > 10) return "in_stock";
  if (available > 0) return "low_stock";
  return "out_of_stock";
}

@Injectable()
export class CartHandlerService {
  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  // ─── helpers ──────────────────────────────────────────────────────────────

  private async findCart(identity: CartIdentity) {
    const { storeId, sessionToken, userId } = identity;
    return this.db.query.cartsTable.findFirst({
      where: (c) =>
        and(
          eq(c.storeId, storeId),
          userId
            ? eq(c.userId, userId)
            : sessionToken
              ? eq(c.sessionToken, sessionToken)
              : sql`false`,
        ),
    });
  }

  private async enrichCart(cartId: string | null) {
    if (!cartId) {
      return { id: null, items: [], subtotalCents: 0, itemCount: 0, expiresAt: null };
    }

    const cart = await this.db.query.cartsTable.findFirst({
      where: (c) => eq(c.id, cartId),
    });
    if (!cart) {
      return { id: null, items: [], subtotalCents: 0, itemCount: 0, expiresAt: null };
    }

    const rows = await this.db
      .select({
        variantId: cartItemsTable.variantId,
        quantity: cartItemsTable.quantity,
        productId: productVariantsTable.productId,
        productName: productsTable.name,
        variantName: productVariantsTable.name,
        sku: productVariantsTable.sku,
        priceCents: productVariantsTable.priceCents,
        compareAtCents: productVariantsTable.compareAtCents,
        stock: inventoryTable.stock,
        reserved: inventoryTable.reserved,
        allowBackorder: inventoryTable.allowBackorder,
      })
      .from(cartItemsTable)
      .innerJoin(productVariantsTable, eq(cartItemsTable.variantId, productVariantsTable.id))
      .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
      .innerJoin(inventoryTable, eq(cartItemsTable.variantId, inventoryTable.variantId))
      .where(eq(cartItemsTable.cartId, cartId));

    // Fetch primary images for all products in one query
    const productIds = [...new Set(rows.map((r) => r.productId))];
    const images =
      productIds.length > 0
        ? await this.db
            .selectDistinctOn([productImagesTable.productId], {
              productId: productImagesTable.productId,
              cdnUrl: productImagesTable.cdnUrl,
            })
            .from(productImagesTable)
            .where(inArray(productImagesTable.productId, productIds))
            .orderBy(productImagesTable.productId, productImagesTable.sortOrder)
        : [];

    const imageMap = new Map(images.map((img) => [img.productId, img.cdnUrl]));

    const items = rows.map((row) => ({
      variantId: row.variantId,
      productId: row.productId,
      productName: row.productName,
      variantName: row.variantName,
      sku: row.sku,
      priceCents: row.priceCents,
      compareAtCents: row.compareAtCents ?? null,
      primaryImageUrl: imageMap.get(row.productId) ?? null,
      quantity: row.quantity,
      lineTotalCents: row.priceCents * row.quantity,
      availability: toAvailability(row.stock, row.reserved, row.allowBackorder),
    }));

    return {
      id: cart.id,
      items,
      subtotalCents: items.reduce((sum, i) => sum + i.lineTotalCents, 0),
      itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
      expiresAt: cart.expiresAt?.toISOString() ?? null,
    };
  }

  private sevenDaysFromNow() {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d;
  }

  // ─── public methods ────────────────────────────────────────────────────────

  async get(identity: CartIdentity) {
    const cart = await this.findCart(identity);
    return this.enrichCart(cart?.id ?? null);
  }

  async addItem(identity: CartIdentity, variantId: string, quantity: number) {
    const { storeId } = identity;

    // Fetch with product join for status + goesLiveAt check, and inventory for stock
    const [variantRow] = await this.db
      .select({
        variantId: productVariantsTable.id,
        isActive: productVariantsTable.isActive,
        productStatus: productsTable.status,
        goesLiveAt: productsTable.goesLiveAt,
        stock: inventoryTable.stock,
        reserved: inventoryTable.reserved,
        allowBackorder: inventoryTable.allowBackorder,
      })
      .from(productVariantsTable)
      .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
      .innerJoin(inventoryTable, eq(productVariantsTable.id, inventoryTable.variantId))
      .where(and(eq(productVariantsTable.id, variantId), eq(productVariantsTable.storeId, storeId)))
      .limit(1);

    if (!variantRow) throw new NotFoundException("Variant not found");
    if (!variantRow.isActive) throw new BadRequestException("Variant is not active");
    if (variantRow.productStatus !== "active") {
      throw new BadRequestException("Product is not available");
    }
    if (variantRow.goesLiveAt && variantRow.goesLiveAt > new Date()) {
      throw new BadRequestException("Product is not yet available");
    }

    // Find or lazy-create cart
    let cart = await this.findCart(identity);
    if (!cart) {
      const [newCart] = await this.db
        .insert(cartsTable)
        .values({
          storeId,
          sessionToken: identity.sessionToken ?? null,
          userId: identity.userId ?? null,
          expiresAt: this.sevenDaysFromNow(),
        })
        .returning();
      cart = newCart;
    }

    // Check max 50 distinct line items
    const [{ count }] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cartId, cart.id));

    const existing = await this.db.query.cartItemsTable.findFirst({
      where: (ci) => and(eq(ci.cartId, cart!.id), eq(ci.variantId, variantId)),
    });

    if (!existing && count >= 50) {
      throw new BadRequestException("Cart cannot exceed 50 distinct items");
    }

    const newTotalQuantity = (existing?.quantity ?? 0) + quantity;
    if (!variantRow.allowBackorder) {
      const available = variantRow.stock - variantRow.reserved;
      if (newTotalQuantity > available) {
        throw new BadRequestException(
          `Only ${available} unit${available === 1 ? "" : "s"} available`,
        );
      }
    }

    if (existing) {
      await this.db
        .update(cartItemsTable)
        .set({ quantity: newTotalQuantity })
        .where(eq(cartItemsTable.id, existing.id));
    } else {
      await this.db.insert(cartItemsTable).values({ cartId: cart.id, variantId, quantity });
    }

    // Reset expiry on every mutation
    await this.db
      .update(cartsTable)
      .set({ expiresAt: this.sevenDaysFromNow() })
      .where(eq(cartsTable.id, cart.id));

    return this.enrichCart(cart.id);
  }

  async updateItem(identity: CartIdentity, variantId: string, quantity: number) {
    const cart = await this.findCart(identity);
    if (!cart) throw new NotFoundException("Cart not found");

    if (quantity === 0) {
      await this.db
        .delete(cartItemsTable)
        .where(and(eq(cartItemsTable.cartId, cart.id), eq(cartItemsTable.variantId, variantId)));
    } else {
      const [updated] = await this.db
        .update(cartItemsTable)
        .set({ quantity })
        .where(and(eq(cartItemsTable.cartId, cart.id), eq(cartItemsTable.variantId, variantId)))
        .returning();
      if (!updated) throw new NotFoundException("Item not in cart");
    }

    await this.db
      .update(cartsTable)
      .set({ expiresAt: this.sevenDaysFromNow() })
      .where(eq(cartsTable.id, cart.id));

    return this.enrichCart(cart.id);
  }

  async removeItem(identity: CartIdentity, variantId: string) {
    const cart = await this.findCart(identity);
    if (!cart) throw new NotFoundException("Cart not found");

    const deleted = await this.db
      .delete(cartItemsTable)
      .where(and(eq(cartItemsTable.cartId, cart.id), eq(cartItemsTable.variantId, variantId)))
      .returning();

    if (deleted.length === 0) throw new NotFoundException("Item not in cart");

    await this.db
      .update(cartsTable)
      .set({ expiresAt: this.sevenDaysFromNow() })
      .where(eq(cartsTable.id, cart.id));

    return this.enrichCart(cart.id);
  }

  async merge(storeId: string, sessionToken: string, userId: string) {
    const anonCart = await this.db.query.cartsTable.findFirst({
      where: (c) => and(eq(c.storeId, storeId), eq(c.sessionToken, sessionToken)),
    });
    if (!anonCart) return; // Nothing to merge

    const userCart = await this.db.query.cartsTable.findFirst({
      where: (c) => and(eq(c.storeId, storeId), eq(c.userId, userId)),
    });

    if (!userCart) {
      // Reassign anon cart to userId
      await this.db
        .update(cartsTable)
        .set({ userId, sessionToken: null })
        .where(eq(cartsTable.id, anonCart.id));
      return;
    }

    // Merge: sum quantities for matching variants, then delete anon cart
    const anonItems = await this.db.query.cartItemsTable.findMany({
      where: (ci) => eq(ci.cartId, anonCart.id),
    });

    for (const item of anonItems) {
      const existing = await this.db.query.cartItemsTable.findFirst({
        where: (ci) => and(eq(ci.cartId, userCart.id), eq(ci.variantId, item.variantId)),
      });
      if (existing) {
        await this.db
          .update(cartItemsTable)
          .set({ quantity: existing.quantity + item.quantity })
          .where(eq(cartItemsTable.id, existing.id));
      } else {
        await this.db
          .insert(cartItemsTable)
          .values({ cartId: userCart.id, variantId: item.variantId, quantity: item.quantity });
      }
    }

    await this.db.delete(cartsTable).where(eq(cartsTable.id, anonCart.id));
  }
}
