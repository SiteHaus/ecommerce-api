import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import {
  and,
  cartItemsTable,
  cartsTable,
  eq,
  inventoryTable,
  orderItemsTable,
  ordersTable,
  productVariantsTable,
  productsTable,
  storesTable,
  type Db,
} from "@sitehaus-ecom/database";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import { ReservationService } from "../inventory/reservation.service";

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
    email: string;
    shippingName: string;
    shippingLine1: string;
    shippingLine2?: string;
    shippingCity: string;
    shippingState: string;
    shippingZip: string;
    shippingCountry: string;
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
        variantId: cartItemsTable.variantId,
        quantity: cartItemsTable.quantity,
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

    if (items.length === 0) throw new BadRequestException("Cart is empty");

    // 3. Calculate totals
    const subtotalCents = items.reduce((sum, i) => sum + i.priceCents * i.quantity, 0);
    const shippingCents = 0; // TODO SIT-86: shipping rate lookup
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
        email: data.email,
        status: "pending",
        shippingName: data.shippingName,
        shippingLine1: data.shippingLine1,
        shippingLine2: data.shippingLine2 ?? null,
        shippingCity: data.shippingCity,
        shippingState: data.shippingState,
        shippingZip: data.shippingZip,
        shippingCountry: data.shippingCountry,
        subtotalCents,
        shippingCents,
        taxCents,
        totalCents,
        currency: store?.currency ?? "usd",
      })
      .returning();

    // 5. Snapshot cart items into order_items
    await this.db.insert(orderItemsTable).values(
      items.map((item) => ({
        orderId: order.id,
        variantId: item.variantId,
        productName: item.productName,
        variantName: item.variantName,
        sku: item.sku ?? null,
        quantity: item.quantity,
        unitPriceCents: item.priceCents,
        totalCents: item.priceCents * item.quantity,
      })),
    );

    // 6. Reserve inventory — rollback if any item is sold out
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
