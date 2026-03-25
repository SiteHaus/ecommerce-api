import { Injectable, NotFoundException } from "@nestjs/common";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import { Inject } from "@nestjs/common";
import { Db, inventoryTable, productsTable, productVariantsTable } from "@sitehaus-ecom/database";
import { and, eq, sql, inArray } from "@sitehaus-ecom/database";
import {
  AdminQueryParams,
  CreateProductDto,
  PublicQueryParams,
  UpdateProductDto,
} from "@sitehaus-ecom/validation";

@Injectable()
export class ProductsHandlerService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async create(data: CreateProductDto & { storeId: string }) {
    const [product] = await this.db
      .insert(productsTable)
      .values({
        storeId: data.storeId,
        name: data.name,
        description: data.description,
        status: data.status,
        goesLiveAt: data.goesLiveAt ? new Date(data.goesLiveAt) : null,
      })
      .returning();

    await this.audit.log({
      storeId: data.storeId,
      action: "product.created",
      targetType: "product",
      targetId: product.id,
    });

    return product;
  }

  async update(data: UpdateProductDto & { storeId: string }) {
    const existing = await this.db.query.productsTable.findFirst({
      where: (v) => and(eq(v.id, data.id), eq(v.storeId, data.storeId)),
    });
    if (!existing) throw new NotFoundException("Product not found");

    const [product] = await this.db
      .update(productsTable)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.goesLiveAt !== undefined && {
          goesLiveAt: data.goesLiveAt ? new Date(data.goesLiveAt) : null,
        }),
      })
      .where(and(eq(productsTable.id, data.id), eq(productsTable.storeId, data.storeId)))
      .returning();

    await this.audit.log({
      storeId: product.storeId,
      action: "product.updated",
      targetType: "product",
      targetId: product.id,
    });

    return product;
  }

  async delete(data: { id: string; storeId: string }) {
    const existing = await this.db.query.productsTable.findFirst({
      where: (v) => and(eq(v.id, data.id), eq(v.storeId, data.storeId)),
    });
    if (!existing) throw new NotFoundException("Product not found");

    await this.db
      .update(productsTable)
      .set({ status: "archived" })
      .where(and(eq(productsTable.id, data.id), eq(productsTable.storeId, data.storeId)));

    await this.audit.log({
      storeId: data.storeId,
      action: "product.archived",
      targetType: "product",
      targetId: data.id,
    });

    return { message: "The product was successfully archived" };
  }

  async listProducts(data: AdminQueryParams & { storeId: string }) {
    const where = and(
      eq(productsTable.storeId, data.storeId),
      data.status ? eq(productsTable.status, data.status) : undefined,
    );

    const [{ count }] = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(productsTable)
      .where(where);

    const products = await this.db.query.productsTable.findMany({
      where,
      limit: data.limit,
      offset: data.offset,
    });

    const productIds = products.map((p) => p.id);

    const [allImages, variantCounts] = await Promise.all([
      this.db.query.productImagesTable.findMany({
        where: (img, { inArray }) => inArray(img.productId, productIds),
      }),
      this.db
        .select({
          productId: productVariantsTable.productId,
          count: sql<string>`count(*)`,
        })
        .from(productVariantsTable)
        .where(inArray(productVariantsTable.productId, productIds))
        .groupBy(productVariantsTable.productId),
    ]);

    const items = products.map((p) => {
      const primaryImage = allImages.find((img) => img.productId === p.id) ?? null;
      const variantCount = variantCounts.find((v) => v.productId === p.id);

      return {
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        status: p.status,
        goesLiveAt: p.goesLiveAt?.toISOString() ?? null,
        variantCount: Number(variantCount?.count ?? 0),
        primaryImage: primaryImage
          ? { cdnUrl: primaryImage.cdnUrl, altText: primaryImage.altText ?? null }
          : null,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      };
    });

    return { items, total: Number(count) };
  }

  async getProduct(data: { id: string; storeId: string }) {
    const product = await this.db.query.productsTable.findFirst({
      where: (v) => and(eq(v.id, data.id), eq(v.storeId, data.storeId)),
    });
    if (!product) throw new NotFoundException("Product not found");

    const rows = await this.db
      .select({
        id: productVariantsTable.id,
        name: productVariantsTable.name,
        sku: productVariantsTable.sku,
        priceCents: productVariantsTable.priceCents,
        compareAtCents: productVariantsTable.compareAtCents,
        isActive: productVariantsTable.isActive,
        sortOrder: productVariantsTable.sortOrder,
        stock: inventoryTable.stock,
        reserved: inventoryTable.reserved,
      })
      .from(productVariantsTable)
      .leftJoin(
        inventoryTable,
        and(
          eq(inventoryTable.variantId, productVariantsTable.id),
          eq(inventoryTable.storeId, data.storeId),
        ),
      )
      .where(
        and(
          eq(productVariantsTable.productId, data.id),
          eq(productVariantsTable.storeId, data.storeId),
        ),
      );

    return {
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      status: product.status,
      goesLiveAt: product.goesLiveAt?.toISOString() ?? null,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      variants: rows.map((v) => ({
        id: v.id,
        name: v.name,
        sku: v.sku ?? null,
        priceCents: v.priceCents,
        compareAtCents: v.compareAtCents ?? null,
        isActive: v.isActive,
        sortOrder: v.sortOrder,
        stock: v.stock ?? 0,
        reserved: v.reserved ?? 0,
        availability: getAvailability({ stock: v.stock ?? 0, reserved: v.reserved ?? 0 }),
      })),
    };
  }

  async listPublic(data: PublicQueryParams & { storeId: string }) {
    const where = and(eq(productsTable.storeId, data.storeId), eq(productsTable.status, "active"));

    const [{ count }] = await this.db
      .select({ count: sql<string>`count(*)` })
      .from(productsTable)
      .where(where);

    const products = await this.db.query.productsTable.findMany({
      where,
      limit: data.limit,
      offset: data.offset,
    });

    const productIds = products.map((p) => p.id);

    const [allImages, allVariants] = await Promise.all([
      this.db.query.productImagesTable.findMany({
        where: (img, { inArray }) => inArray(img.productId, productIds),
      }),
      this.db
        .select({
          id: productVariantsTable.id,
          productId: productVariantsTable.productId,
          name: productVariantsTable.name,
          priceCents: productVariantsTable.priceCents,
          compareAtCents: productVariantsTable.compareAtCents,
          stock: inventoryTable.stock,
          reserved: inventoryTable.reserved,
        })
        .from(productVariantsTable)
        .leftJoin(
          inventoryTable,
          and(
            eq(inventoryTable.variantId, productVariantsTable.id),
            eq(inventoryTable.storeId, data.storeId),
          ),
        )
        .where(inArray(productVariantsTable.productId, productIds)),
    ]);

    const now = new Date();

    const items = products.map((p) => {
      const scheduled = p.goesLiveAt ? new Date(p.goesLiveAt) > now : false;
      const primaryImage = allImages.find((img) => img.productId === p.id) ?? null;
      const variants = allVariants.filter((v) => v.productId === p.id);

      return {
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        scheduled,
        goesLiveAt: p.goesLiveAt?.toISOString() ?? null,
        primaryImage: primaryImage
          ? { cdnUrl: primaryImage.cdnUrl, altText: primaryImage.altText ?? null }
          : null,
        variants: scheduled
          ? null
          : variants.map((v) => ({
              id: v.id,
              name: v.name,
              priceCents: v.priceCents,
              compareAtCents: v.compareAtCents ?? null,
              availability: getAvailability({ stock: v.stock ?? 0, reserved: v.reserved ?? 0 }),
            })),
      };
    });

    return { items, total: Number(count) };
  }
}

function getAvailability(inventory: {
  stock: number;
  reserved: number;
}): "in_stock" | "low_stock" | "out_of_stock" {
  const available = inventory.stock - inventory.reserved;
  if (available <= 0) return "out_of_stock";
  if (available <= 5) return "low_stock";
  return "in_stock";
}
