import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  and,
  cartItemsTable,
  cartsTable,
  collectionsTable,
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
import {
  collectionCoverUrls,
  findWholeOnlyProducts,
  isCollectionSellable,
  WHOLE_COLLECTION_VARIANT_NAME,
} from "../collections/sell-as-whole";

type CartIdentity = { storeId: string; sessionToken?: string; userId?: string };
type Availability = "in_stock" | "low_stock" | "out_of_stock";

const MAX_CART_LINES = 50;

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

  private async findOrCreateCart(identity: CartIdentity) {
    const existing = await this.findCart(identity);
    if (existing) return existing;
    const [newCart] = await this.db
      .insert(cartsTable)
      .values({
        storeId: identity.storeId,
        sessionToken: identity.sessionToken ?? null,
        userId: identity.userId ?? null,
        expiresAt: this.sevenDaysFromNow(),
      })
      .returning();
    return newCart;
  }

  private async lineCount(cartId: string) {
    const [{ count }] = await this.db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cartId, cartId));
    return count;
  }

  private async touch(cartId: string) {
    await this.db
      .update(cartsTable)
      .set({ expiresAt: this.sevenDaysFromNow() })
      .where(eq(cartsTable.id, cartId));
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
        addedAt: cartItemsTable.addedAt,
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

    const collectionRows = await this.db
      .select({
        collectionId: collectionsTable.id,
        quantity: cartItemsTable.quantity,
        addedAt: cartItemsTable.addedAt,
        name: collectionsTable.name,
        sellAsWhole: collectionsTable.sellAsWhole,
        priceCents: collectionsTable.priceCents,
        goesLiveAt: collectionsTable.goesLiveAt,
      })
      .from(cartItemsTable)
      .innerJoin(collectionsTable, eq(cartItemsTable.collectionId, collectionsTable.id))
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
    const coverMap = await collectionCoverUrls(
      this.db,
      collectionRows.map((r) => r.collectionId),
    );

    const variantItems = rows.map((row) => ({
      addedAt: row.addedAt,
      type: "variant" as const,
      variantId: row.variantId,
      collectionId: null,
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

    const collectionItems = collectionRows.map((row) => {
      const priceCents = row.priceCents ?? 0;
      return {
        addedAt: row.addedAt,
        type: "collection" as const,
        variantId: null,
        collectionId: row.collectionId,
        productId: null,
        productName: row.name,
        variantName: WHOLE_COLLECTION_VARIANT_NAME,
        sku: null,
        priceCents,
        compareAtCents: null,
        primaryImageUrl: coverMap.get(row.collectionId) ?? null,
        quantity: row.quantity,
        lineTotalCents: priceCents * row.quantity,
        // No inventory for a bundle; it's unavailable only if it stopped being sold whole
        availability: (isCollectionSellable(row) ? "in_stock" : "out_of_stock") as Availability,
      };
    });

    const items = [...variantItems, ...collectionItems]
      .sort((a, b) => a.addedAt.getTime() - b.addedAt.getTime())
      .map(({ addedAt: _addedAt, ...item }) => item);

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
        productId: productVariantsTable.productId,
        productName: productsTable.name,
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

    const wholeOnly = await findWholeOnlyProducts(this.db, storeId, [variantRow.productId]);
    const bundleName = wholeOnly.get(variantRow.productId);
    if (bundleName) {
      throw new BadRequestException(
        `"${variantRow.productName}" is only sold as part of the "${bundleName}" collection`,
      );
    }

    // Find or lazy-create cart
    const cart = await this.findOrCreateCart(identity);

    const count = await this.lineCount(cart.id);

    const existing = await this.db.query.cartItemsTable.findFirst({
      where: (ci) => and(eq(ci.cartId, cart.id), eq(ci.variantId, variantId)),
    });

    if (!existing && count >= MAX_CART_LINES) {
      throw new BadRequestException(`Cart cannot exceed ${MAX_CART_LINES} distinct items`);
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
    await this.touch(cart.id);

    return this.enrichCart(cart.id);
  }

  /** Add a whole collection (sellAsWhole) as one line. Always quantity 1; adding twice is a no-op. */
  async addCollection(identity: CartIdentity, collectionId: string) {
    const { storeId } = identity;

    const collection = await this.db.query.collectionsTable.findFirst({
      where: (c) => and(eq(c.id, collectionId), eq(c.storeId, storeId)),
    });
    if (!collection) throw new NotFoundException("Collection not found");
    if (!collection.sellAsWhole) {
      throw new BadRequestException("This collection isn't sold as a whole");
    }
    if (!isCollectionSellable(collection)) {
      throw new BadRequestException("This collection isn't available yet");
    }

    const cart = await this.findOrCreateCart(identity);

    const existing = await this.db.query.cartItemsTable.findFirst({
      where: (ci) => and(eq(ci.cartId, cart.id), eq(ci.collectionId, collectionId)),
    });

    if (!existing) {
      if ((await this.lineCount(cart.id)) >= MAX_CART_LINES) {
        throw new BadRequestException(`Cart cannot exceed ${MAX_CART_LINES} distinct items`);
      }
      await this.db.insert(cartItemsTable).values({ cartId: cart.id, collectionId, quantity: 1 });
    }

    await this.touch(cart.id);
    return this.enrichCart(cart.id);
  }

  async removeCollection(identity: CartIdentity, collectionId: string) {
    const cart = await this.findCart(identity);
    if (!cart) throw new NotFoundException("Cart not found");

    const deleted = await this.db
      .delete(cartItemsTable)
      .where(and(eq(cartItemsTable.cartId, cart.id), eq(cartItemsTable.collectionId, collectionId)))
      .returning();

    if (deleted.length === 0) throw new NotFoundException("Collection not in cart");

    await this.touch(cart.id);
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

    await this.touch(cart.id);

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

    await this.touch(cart.id);

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

    // Merge: sum quantities for matching variants, keep one of each collection,
    // then delete anon cart
    const anonItems = await this.db.query.cartItemsTable.findMany({
      where: (ci) => eq(ci.cartId, anonCart.id),
    });

    for (const item of anonItems) {
      if (item.collectionId) {
        const collectionId = item.collectionId;
        const existing = await this.db.query.cartItemsTable.findFirst({
          where: (ci) => and(eq(ci.cartId, userCart.id), eq(ci.collectionId, collectionId)),
        });
        if (!existing) {
          await this.db
            .insert(cartItemsTable)
            .values({ cartId: userCart.id, collectionId, quantity: 1 });
        }
        continue;
      }

      if (!item.variantId) continue;
      const variantId = item.variantId;
      const existing = await this.db.query.cartItemsTable.findFirst({
        where: (ci) => and(eq(ci.cartId, userCart.id), eq(ci.variantId, variantId)),
      });
      if (existing) {
        await this.db
          .update(cartItemsTable)
          .set({ quantity: existing.quantity + item.quantity })
          .where(eq(cartItemsTable.id, existing.id));
      } else {
        await this.db
          .insert(cartItemsTable)
          .values({ cartId: userCart.id, variantId, quantity: item.quantity });
      }
    }

    await this.db.delete(cartsTable).where(eq(cartsTable.id, anonCart.id));
  }
}
