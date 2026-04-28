import { Injectable, NotFoundException } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import { Inject } from "@nestjs/common";
import {
  Db,
  inventoryTable,
  productImagesTable,
  productOptionValuesTable,
  productOptionsTable,
  productsTable,
  productVariantsTable,
  variantOptionValuesTable,
} from "@sitehaus-ecom/database";
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
    const goesLiveAt = data.goesLiveAt ? new Date(data.goesLiveAt) : null;
    const status = goesLiveAt && goesLiveAt > new Date() ? "scheduled" : (data.status ?? "draft");

    const [product] = await this.db
      .insert(productsTable)
      .values({
        storeId: data.storeId,
        name: data.name,
        description: data.description,
        status,
        goesLiveAt,
        brand: data.brand,
        gtin: data.gtin,
        mpn: data.mpn,
        condition: data.condition,
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

    // Resolve effective goesLiveAt after this update
    const goesLiveAt =
      data.goesLiveAt !== undefined
        ? data.goesLiveAt
          ? new Date(data.goesLiveAt)
          : null
        : existing.goesLiveAt;

    // Guard: cannot manually activate while a future go-live date is set
    if (data.status === "active" && goesLiveAt && goesLiveAt > new Date()) {
      throw new RpcException({
        status: 400,
        message: "Cannot activate a product with a future go-live date",
      });
    }

    // Auto-derive status from goesLiveAt changes
    let resolvedStatus = data.status;
    if (data.goesLiveAt !== undefined) {
      const newGoesLiveAt = data.goesLiveAt ? new Date(data.goesLiveAt) : null;
      if (newGoesLiveAt && newGoesLiveAt > new Date()) {
        resolvedStatus = "scheduled";
      } else if (!newGoesLiveAt && existing.status === "scheduled") {
        resolvedStatus = "draft";
      }
    }

    const [product] = await this.db
      .update(productsTable)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(resolvedStatus !== undefined && { status: resolvedStatus }),
        ...(data.goesLiveAt !== undefined && { goesLiveAt }),
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.gtin !== undefined && { gtin: data.gtin }),
        ...(data.mpn !== undefined && { mpn: data.mpn }),
        ...(data.condition !== undefined && { condition: data.condition }),
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

    const [variantRows, optionRows, variantIds] = await Promise.all([
      this.db
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
        ),
      this.db
        .select({
          id: productOptionsTable.id,
          name: productOptionsTable.name,
          sortOrder: productOptionsTable.sortOrder,
          valueId: productOptionValuesTable.id,
          value: productOptionValuesTable.value,
          valueSortOrder: productOptionValuesTable.sortOrder,
        })
        .from(productOptionsTable)
        .leftJoin(
          productOptionValuesTable,
          eq(productOptionValuesTable.optionId, productOptionsTable.id),
        )
        .where(eq(productOptionsTable.productId, data.id)),
      this.db
        .select({ id: productVariantsTable.id })
        .from(productVariantsTable)
        .where(
          and(
            eq(productVariantsTable.productId, data.id),
            eq(productVariantsTable.storeId, data.storeId),
          ),
        )
        .then((rows) => rows.map((r) => r.id)),
    ]);

    const optionValuesForVariants =
      variantIds.length > 0
        ? await this.db
            .select({
              variantId: variantOptionValuesTable.variantId,
              valueId: productOptionValuesTable.id,
              value: productOptionValuesTable.value,
              optionId: productOptionsTable.id,
              optionName: productOptionsTable.name,
            })
            .from(variantOptionValuesTable)
            .innerJoin(
              productOptionValuesTable,
              eq(variantOptionValuesTable.optionValueId, productOptionValuesTable.id),
            )
            .innerJoin(
              productOptionsTable,
              eq(productOptionValuesTable.optionId, productOptionsTable.id),
            )
            .where(inArray(variantOptionValuesTable.variantId, variantIds))
        : [];

    const options = buildOptions(optionRows);

    return {
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      status: product.status,
      goesLiveAt: product.goesLiveAt?.toISOString() ?? null,
      brand: product.brand ?? null,
      gtin: product.gtin ?? null,
      mpn: product.mpn ?? null,
      condition: product.condition,
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
      options,
      variants: variantRows.map((v) => ({
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
        optionValues: optionValuesForVariants
          .filter((ov) => ov.variantId === v.id)
          .map((ov) => ({
            optionId: ov.optionId,
            optionName: ov.optionName,
            valueId: ov.valueId,
            value: ov.value,
          })),
      })),
    };
  }

  async getPublicProduct(data: { id: string; storeId: string }) {
    const product = await this.db.query.productsTable.findFirst({
      where: (v) => and(eq(v.id, data.id), eq(v.storeId, data.storeId), eq(v.status, "active")),
    });
    if (!product) throw new NotFoundException("Product not found");

    const scheduled = product.goesLiveAt ? new Date(product.goesLiveAt) > new Date() : false;

    const [allImages, optionRows] = await Promise.all([
      this.db
        .select()
        .from(productImagesTable)
        .where(eq(productImagesTable.productId, data.id))
        .orderBy(productImagesTable.sortOrder),
      this.db
        .select({
          id: productOptionsTable.id,
          name: productOptionsTable.name,
          sortOrder: productOptionsTable.sortOrder,
          valueId: productOptionValuesTable.id,
          value: productOptionValuesTable.value,
          valueSortOrder: productOptionValuesTable.sortOrder,
        })
        .from(productOptionsTable)
        .leftJoin(
          productOptionValuesTable,
          eq(productOptionValuesTable.optionId, productOptionsTable.id),
        )
        .where(eq(productOptionsTable.productId, data.id)),
    ]);

    const primaryImage = allImages[0] ?? null;
    const images = allImages.map((img) => ({ cdnUrl: img.cdnUrl, altText: img.altText ?? null }));
    const options = buildOptions(optionRows);

    let variants = null;
    if (!scheduled) {
      const variantRows = await this.db
        .select({
          id: productVariantsTable.id,
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
        .where(
          and(
            eq(productVariantsTable.productId, data.id),
            eq(productVariantsTable.storeId, data.storeId),
          ),
        );

      const variantIds = variantRows.map((v) => v.id);
      const optionValuesForVariants =
        variantIds.length > 0
          ? await this.db
              .select({
                variantId: variantOptionValuesTable.variantId,
                valueId: productOptionValuesTable.id,
                value: productOptionValuesTable.value,
                optionId: productOptionsTable.id,
                optionName: productOptionsTable.name,
              })
              .from(variantOptionValuesTable)
              .innerJoin(
                productOptionValuesTable,
                eq(variantOptionValuesTable.optionValueId, productOptionValuesTable.id),
              )
              .innerJoin(
                productOptionsTable,
                eq(productOptionValuesTable.optionId, productOptionsTable.id),
              )
              .where(inArray(variantOptionValuesTable.variantId, variantIds))
          : [];

      variants = variantRows.map((v) => ({
        id: v.id,
        name: v.name,
        priceCents: v.priceCents,
        compareAtCents: v.compareAtCents ?? null,
        availability: getAvailability({ stock: v.stock ?? 0, reserved: v.reserved ?? 0 }),
        optionValues: optionValuesForVariants
          .filter((ov) => ov.variantId === v.id)
          .map((ov) => ({
            optionId: ov.optionId,
            optionName: ov.optionName,
            valueId: ov.valueId,
            value: ov.value,
          })),
      }));
    }

    return {
      id: product.id,
      name: product.name,
      description: product.description ?? null,
      brand: product.brand ?? null,
      scheduled,
      goesLiveAt: product.goesLiveAt?.toISOString() ?? null,
      primaryImage: primaryImage
        ? { cdnUrl: primaryImage.cdnUrl, altText: primaryImage.altText ?? null }
        : null,
      images,
      options,
      variants,
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

    const variantIds = allVariants.map((v) => v.id);
    const allVariantOptionValues =
      variantIds.length > 0
        ? await this.db
            .select({
              variantId: variantOptionValuesTable.variantId,
              valueId: productOptionValuesTable.id,
              value: productOptionValuesTable.value,
              optionId: productOptionsTable.id,
              optionName: productOptionsTable.name,
            })
            .from(variantOptionValuesTable)
            .innerJoin(
              productOptionValuesTable,
              eq(variantOptionValuesTable.optionValueId, productOptionValuesTable.id),
            )
            .innerJoin(
              productOptionsTable,
              eq(productOptionValuesTable.optionId, productOptionsTable.id),
            )
            .where(inArray(variantOptionValuesTable.variantId, variantIds))
        : [];

    const now = new Date();

    const items = products.map((p) => {
      const scheduled = p.goesLiveAt ? new Date(p.goesLiveAt) > now : false;
      const primaryImage = allImages.find((img) => img.productId === p.id) ?? null;
      const variants = allVariants.filter((v) => v.productId === p.id);

      return {
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        status: p.status,
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
              optionValues: allVariantOptionValues
                .filter((ov) => ov.variantId === v.id)
                .map((ov) => ({
                  optionId: ov.optionId,
                  optionName: ov.optionName,
                  valueId: ov.valueId,
                  value: ov.value,
                })),
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

function buildOptions(
  rows: {
    id: string;
    name: string;
    sortOrder: number;
    valueId: string | null;
    value: string | null;
    valueSortOrder: number | null;
  }[],
) {
  const map = new Map<
    string,
    {
      id: string;
      name: string;
      sortOrder: number;
      values: { id: string; value: string; sortOrder: number }[];
    }
  >();
  for (const row of rows) {
    if (!map.has(row.id))
      map.set(row.id, { id: row.id, name: row.name, sortOrder: row.sortOrder, values: [] });
    if (row.valueId && row.value !== null) {
      map
        .get(row.id)!
        .values.push({ id: row.valueId, value: row.value, sortOrder: row.valueSortOrder ?? 0 });
    }
  }
  return [...map.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}
