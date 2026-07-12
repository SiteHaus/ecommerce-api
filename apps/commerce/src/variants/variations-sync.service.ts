import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { AuditService, DB_TOKEN } from "@sitehaus-ecom/shared";
import {
  and,
  eq,
  inArray,
  notInArray,
  Db,
  inventoryTable,
  orderItemsTable,
  ordersTable,
  productOptionValuesTable,
  productOptionsTable,
  productVariantsTable,
  variantOptionValuesTable,
} from "@sitehaus-ecom/database";
import type { SyncVariationsDto } from "@sitehaus-ecom/validation";
import { diffVariants, generateCombinations, keyOf } from "./variations.logic";

@Injectable()
export class VariationsSyncService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  async sync(data: { productId: string; storeId: string } & SyncVariationsDto) {
    const product = await this.db.query.productsTable.findFirst({
      where: (p) => and(eq(p.id, data.productId), eq(p.storeId, data.storeId)),
    });
    if (!product) throw new NotFoundException("Product not found.");

    // Validate rows are a subset of the generated combination space.
    const validKeys = new Set(generateCombinations(data.dimensions).map(keyOf));
    for (const row of data.rows) {
      if (!validKeys.has(keyOf(row.values))) {
        throw new NotFoundException(`Combination not valid: ${row.values.join(" / ")}`);
      }
    }

    const blocked: { variantId: string; name: string }[] = [];

    await this.db.transaction(async (tx) => {
      // 1. Upsert options (by name, in order); delete options no longer present.
      const existingOptions = await tx.query.productOptionsTable.findMany({
        where: (o) => eq(o.productId, data.productId),
      });
      const wantedNames = new Set(data.dimensions.map((d) => d.name));
      const staleOptions = existingOptions.filter((o) => !wantedNames.has(o.name));
      if (staleOptions.length) {
        await tx.delete(productOptionsTable).where(
          inArray(
            productOptionsTable.id,
            staleOptions.map((o) => o.id),
          ),
        ); // cascades values + variant_option_values
      }

      const valueIdByDimValue = new Map<string, string>(); // key: `${dimIdx}:${value}` -> valueId
      for (let i = 0; i < data.dimensions.length; i++) {
        const dim = data.dimensions[i];
        let option = existingOptions.find((o) => o.name === dim.name);
        if (!option) {
          [option] = await tx
            .insert(productOptionsTable)
            .values({
              productId: data.productId,
              name: dim.name,
              sortOrder: i,
            })
            .returning();
        } else {
          await tx
            .update(productOptionsTable)
            .set({ sortOrder: i })
            .where(eq(productOptionsTable.id, option.id));
        }
        const existingValues = await tx.query.productOptionValuesTable.findMany({
          where: (v) => eq(v.optionId, option!.id),
        });
        const wantedValues = new Set(dim.values);
        const staleValues = existingValues.filter((v) => !wantedValues.has(v.value));
        if (staleValues.length) {
          await tx.delete(productOptionValuesTable).where(
            inArray(
              productOptionValuesTable.id,
              staleValues.map((v) => v.id),
            ),
          );
        }
        for (let j = 0; j < dim.values.length; j++) {
          const label = dim.values[j];
          let val = existingValues.find((v) => v.value === label);
          if (!val) {
            [val] = await tx
              .insert(productOptionValuesTable)
              .values({ optionId: option.id, value: label, sortOrder: j })
              .returning();
          } else {
            await tx
              .update(productOptionValuesTable)
              .set({ sortOrder: j })
              .where(eq(productOptionValuesTable.id, val.id));
          }
          valueIdByDimValue.set(`${i}:${label}`, val.id);
        }
      }

      // 2. Load existing variants with their value-key.
      const existingVariants = await tx.query.productVariantsTable.findMany({
        where: (v) => eq(v.productId, data.productId),
      });
      const linkRows = existingVariants.length
        ? await tx
            .select({
              variantId: variantOptionValuesTable.variantId,
              value: productOptionValuesTable.value,
              sortOrder: productOptionsTable.sortOrder,
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
            .where(
              inArray(
                variantOptionValuesTable.variantId,
                existingVariants.map((v) => v.id),
              ),
            )
        : [];
      const keyByVariant = new Map<string, string[]>();
      for (const l of linkRows) {
        const arr = keyByVariant.get(l.variantId) ?? [];
        arr[l.sortOrder] = l.value;
        keyByVariant.set(l.variantId, arr);
      }
      const existing = existingVariants.map((v) => ({
        id: v.id,
        valueKey: keyOf((keyByVariant.get(v.id) ?? []).filter((x) => x !== undefined)),
      }));

      const { toCreate, toUpdate, toDelete } = diffVariants({ existing, rows: data.rows });

      // 3. Deletes (guarded by active orders).
      for (const id of toDelete) {
        const active = await tx
          .select({ id: orderItemsTable.id })
          .from(orderItemsTable)
          .innerJoin(ordersTable, eq(orderItemsTable.orderId, ordersTable.id))
          .where(
            and(
              eq(orderItemsTable.variantId, id),
              notInArray(ordersTable.status, ["cancelled", "abandoned", "refunded", "failed"]),
            ),
          )
          .limit(1);
        if (active.length) {
          const v = existingVariants.find((e) => e.id === id)!;
          // Can't hard-delete a variant with active orders — deactivate it so it's
          // hidden from the storefront while preserved for order history.
          await tx
            .update(productVariantsTable)
            .set({ isActive: false, updatedAt: new Date() })
            .where(eq(productVariantsTable.id, id));
          blocked.push({ variantId: id, name: v.name });
          continue;
        }
        await tx.delete(productVariantsTable).where(eq(productVariantsTable.id, id));
      }

      // 4. Updates.
      for (const { id, row } of toUpdate) {
        await tx
          .update(productVariantsTable)
          .set({
            name: row.values.length ? row.values.join(" / ") : product.name,
            priceCents: row.priceCents,
            sku: row.sku ?? null,
            compareAtCents: row.compareAtCents ?? null,
            isActive: row.isActive ?? true,
            updatedAt: new Date(),
          })
          .where(eq(productVariantsTable.id, id));
        await tx
          .update(inventoryTable)
          .set({ stock: row.stock })
          .where(eq(inventoryTable.variantId, id));
      }

      // 5. Creates.
      for (const row of toCreate) {
        const [variant] = await tx
          .insert(productVariantsTable)
          .values({
            productId: data.productId,
            storeId: data.storeId,
            name: row.values.length ? row.values.join(" / ") : product.name,
            priceCents: row.priceCents,
            sku: row.sku ?? null,
            compareAtCents: row.compareAtCents ?? null,
            isActive: row.isActive ?? true,
            sortOrder: 0,
          })
          .returning();
        await tx
          .insert(inventoryTable)
          .values({ variantId: variant.id, storeId: data.storeId, stock: row.stock, reserved: 0 });
        const optionValueIds = row.values.map(
          (label, i) => valueIdByDimValue.get(`${i}:${label}`)!,
        );
        if (optionValueIds.length) {
          await tx
            .insert(variantOptionValuesTable)
            .values(
              optionValueIds.map((optionValueId) => ({ variantId: variant.id, optionValueId })),
            );
        }
      }
    });

    void this.audit.log({
      storeId: data.storeId,
      action: "variations.synced",
      targetType: "product",
      targetId: data.productId,
    });

    return { productId: data.productId, blocked };
  }
}
