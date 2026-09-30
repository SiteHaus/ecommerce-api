import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  and,
  cartItemsTable,
  cartsTable,
  collectionsTable,
  eq,
  inventoryTable,
  orderItemsTable,
  ordersTable,
  productVariantsTable,
  productsTable,
  shippingRatesTable,
  shippingZonesTable,
  storesTable,
  type Db,
} from "@sitehaus-ecom/database";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import { ReservationService } from "../inventory/reservation.service";
import {
  findWholeOnlyProducts,
  isCollectionSellable,
  WHOLE_COLLECTION_VARIANT_NAME,
} from "../collections/sell-as-whole";

@Injectable()
export class CheckoutService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly reservations: ReservationService,
    private readonly audit: AuditService,
  ) {}

  async createOrder(data: {
    storeId: string;
    sessionToken?: string;
    userId?: string;
    email?: string;
    shippingName?: string;
    shippingCity?: string;
    shippingState?: string;
    shippingZip?: string;
    shippingCountry?: string;
    shippingRateId?: string;
  }) {
    // 1. Locate the cart
    const cartWhere = data.userId
      ? and(eq(cartsTable.storeId, data.storeId), eq(cartsTable.userId, data.userId))
      : and(eq(cartsTable.storeId, data.storeId), eq(cartsTable.sessionToken, data.sessionToken!));

    const cart = await this.db.query.cartsTable.findFirst({ where: cartWhere });

    if (!cart) throw new BadRequestException("Cart not found");
    if (cart.expiresAt < new Date()) throw new BadRequestException("Cart has expired");

    // 2. Fetch items with product/variant snapshots + inventory availability
    const items = await this.db
      .select({
        variantId: productVariantsTable.id,
        quantity: cartItemsTable.quantity,
        productId: productsTable.id,
        productName: productsTable.name,
        variantName: productVariantsTable.name,
        sku: productVariantsTable.sku,
        priceCents: productVariantsTable.priceCents,
        allowBackorder: inventoryTable.allowBackorder,
      })
      .from(cartItemsTable)
      .innerJoin(productVariantsTable, eq(cartItemsTable.variantId, productVariantsTable.id))
      .innerJoin(productsTable, eq(productVariantsTable.productId, productsTable.id))
      .innerJoin(
        inventoryTable,
        and(
          eq(inventoryTable.variantId, productVariantsTable.id),
          eq(inventoryTable.storeId, data.storeId),
        ),
      )
      .where(eq(cartItemsTable.cartId, cart.id));

    // Whole-collection lines (collections sold as a bundle at their own price)
    const bundles = await this.db
      .select({
        collectionId: collectionsTable.id,
        quantity: cartItemsTable.quantity,
        name: collectionsTable.name,
        sellAsWhole: collectionsTable.sellAsWhole,
        priceCents: collectionsTable.priceCents,
        goesLiveAt: collectionsTable.goesLiveAt,
      })
      .from(cartItemsTable)
      .innerJoin(collectionsTable, eq(cartItemsTable.collectionId, collectionsTable.id))
      .where(and(eq(cartItemsTable.cartId, cart.id), eq(collectionsTable.storeId, data.storeId)));

    if (items.length === 0 && bundles.length === 0) {
      throw new BadRequestException("Cart is empty");
    }

    // Products inside a sell-as-whole collection can't be bought on their own,
    // even if they were carted before the collection was switched to whole-only.
    const wholeOnly = await findWholeOnlyProducts(this.db, data.storeId, [
      ...new Set(items.map((i) => i.productId)),
    ]);
    const blocked = items.filter((i) => wholeOnly.has(i.productId));
    if (blocked.length > 0) {
      throw new BadRequestException(
        `These items are only sold as part of a collection: ${blocked
          .map((i) => `${i.productName} (${wholeOnly.get(i.productId)})`)
          .join(", ")}`,
      );
    }

    const unavailable = bundles.filter((b) => !isCollectionSellable(b));
    if (unavailable.length > 0) {
      throw new BadRequestException(
        `The following collections are no longer available: ${unavailable
          .map((b) => b.name)
          .join(", ")}`,
      );
    }

    // 3. Calculate subtotal
    const subtotalCents =
      items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0) +
      bundles.reduce((sum, b) => sum + b.priceCents! * b.quantity, 0);

    // 4. Resolve shipping rate
    let shippingCents = 0;
    let resolvedShippingRateId: string | null = null;

    if (data.shippingCountry) {
      const zones = await this.db.query.shippingZonesTable.findMany({
        where: eq(shippingZonesTable.storeId, data.storeId),
      });
      const coveringZones = zones.filter(
        (z) => !z.countries || z.countries.includes(data.shippingCountry!),
      );
      if (coveringZones.length > 0 && !data.shippingRateId) {
        throw new BadRequestException("shippingRateId is required for this destination");
      }
    }

    if (data.shippingRateId) {
      const [rateWithZone] = await this.db
        .select({
          rateId: shippingRatesTable.id,
          rateCents: shippingRatesTable.rateCents,
          minOrderCents: shippingRatesTable.minOrderCents,
          zoneStoreId: shippingZonesTable.storeId,
          zoneCountries: shippingZonesTable.countries,
        })
        .from(shippingRatesTable)
        .innerJoin(shippingZonesTable, eq(shippingRatesTable.zoneId, shippingZonesTable.id))
        .where(eq(shippingRatesTable.id, data.shippingRateId));

      if (!rateWithZone || rateWithZone.zoneStoreId !== data.storeId) {
        throw new BadRequestException("Invalid shipping rate");
      }

      if (
        data.shippingCountry &&
        rateWithZone.zoneCountries &&
        !rateWithZone.zoneCountries.includes(data.shippingCountry)
      ) {
        throw new BadRequestException("Shipping rate does not cover the destination country");
      }

      // Honor free-shipping threshold
      shippingCents =
        rateWithZone.minOrderCents !== null && subtotalCents >= rateWithZone.minOrderCents
          ? 0
          : rateWithZone.rateCents;
      resolvedShippingRateId = rateWithZone.rateId;
    }

    const taxCents = 0;
    const totalCents = subtotalCents + shippingCents + taxCents;

    const store = await this.db.query.storesTable.findFirst({
      where: eq(storesTable.id, data.storeId),
      columns: { currency: true },
    });

    // 4. Create order row
    const [order] = await this.db
      .insert(ordersTable)
      .values({
        storeId: data.storeId,
        userId: data.userId ?? null,
        email: data.email ?? "",
        status: "pending",
        shippingName: data.shippingName ?? null,
        // shippingLine1/shippingLine2 are deliberately NOT written. The street lives on the
        // Stripe PaymentIntent (see the address-minimization spec). The columns remain,
        // nullable, holding legacy orders' streets until the redaction cron clears them.
        shippingCity: data.shippingCity ?? null,
        shippingState: data.shippingState ?? null,
        shippingZip: data.shippingZip ?? null,
        shippingCountry: data.shippingCountry ?? null,
        shippingRateId: resolvedShippingRateId,
        subtotalCents,
        shippingCents,
        taxCents,
        totalCents,
        currency: store?.currency ?? "usd",
      })
      .returning();

    // 5. Snapshot cart items into order_items
    await this.db.insert(orderItemsTable).values([
      ...items.map((item) => ({
        orderId: order.id,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku ?? null,
        quantity: item.quantity,
        unitPriceCents: item.priceCents,
        totalCents: item.priceCents * item.quantity,
      })),
      ...bundles.map((b) => ({
        orderId: order.id,
        variantId: null,
        collectionId: b.collectionId,
        productName: b.name,
        variantName: WHOLE_COLLECTION_VARIANT_NAME,
        sku: null,
        quantity: b.quantity,
        unitPriceCents: b.priceCents!,
        totalCents: b.priceCents! * b.quantity,
      })),
    ]);

    // 6. Reserve inventory — rollback if any item is sold out.
    //    Whole-collection lines carry no inventory of their own, so nothing to reserve.
    const soldOut: string[] = [];
    for (const item of items) {
      const result = await this.reservations.reserve(
        item.variantId,
        order.id,
        data.storeId,
        item.quantity,
      );
      if (result === "sold_out" && !item.allowBackorder) {
        soldOut.push(item.variantName);
      }
    }

    if (soldOut.length > 0) {
      await this.reservations.releaseByOrder(order.id);
      await this.db.delete(ordersTable).where(eq(ordersTable.id, order.id));
      throw new BadRequestException(`The following items are out of stock: ${soldOut.join(", ")}`);
    }

    this.audit.log({
      storeId: data.storeId,
      userId: data.userId,
      action: "order.created",
      targetType: "order",
      targetId: order.id,
    });

    return {
      orderId: order.id,
      cartId: cart.id,
      subtotalCents,
      shippingCents,
      totalCents,
      currency: store?.currency ?? "usd",
    };
  }
}
