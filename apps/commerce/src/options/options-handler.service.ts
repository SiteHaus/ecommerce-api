import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import {
  Db,
  eq,
  productOptionValuesTable,
  productOptionsTable,
  productsTable,
} from "@sitehaus-ecom/database";
import { DB_TOKEN } from "@sitehaus-ecom/shared";
import type {
  CreateOptionDto,
  CreateOptionValueDto,
  UpdateOptionDto,
  UpdateOptionValueDto,
} from "@sitehaus-ecom/validation";

@Injectable()
export class OptionsHandlerService {
  constructor(@Inject(DB_TOKEN) private readonly db: Db) {}

  async createOption(data: CreateOptionDto & { productId: string; storeId: string }) {
    const product = await this.db.query.productsTable.findFirst({
      where: (p) => eq(p.id, data.productId),
    });
    if (!product || product.storeId !== data.storeId)
      throw new NotFoundException("Product not found");

    const [option] = await this.db
      .insert(productOptionsTable)
      .values({ productId: data.productId, name: data.name, sortOrder: data.sortOrder ?? 0 })
      .returning();

    return { ...option, values: [] };
  }

  async updateOption(data: UpdateOptionDto & { optionId: string; storeId: string }) {
    await this.assertOptionOwnership(data.optionId, data.storeId);

    const [option] = await this.db
      .update(productOptionsTable)
      .set({
        ...(data.name !== undefined && { name: data.name }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      })
      .where(eq(productOptionsTable.id, data.optionId))
      .returning();

    const values = await this.db.query.productOptionValuesTable.findMany({
      where: (v) => eq(v.optionId, option.id),
    });

    return { ...option, values };
  }

  async deleteOption(data: { optionId: string; storeId: string }) {
    await this.assertOptionOwnership(data.optionId, data.storeId);
    await this.db.delete(productOptionsTable).where(eq(productOptionsTable.id, data.optionId));
    return { message: "Option deleted" };
  }

  async createOptionValue(data: CreateOptionValueDto & { optionId: string; storeId: string }) {
    await this.assertOptionOwnership(data.optionId, data.storeId);

    const [value] = await this.db
      .insert(productOptionValuesTable)
      .values({ optionId: data.optionId, value: data.value, sortOrder: data.sortOrder ?? 0 })
      .returning();

    return value;
  }

  async updateOptionValue(data: UpdateOptionValueDto & { valueId: string; storeId: string }) {
    await this.assertValueOwnership(data.valueId, data.storeId);

    const [value] = await this.db
      .update(productOptionValuesTable)
      .set({
        ...(data.value !== undefined && { value: data.value }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
      })
      .where(eq(productOptionValuesTable.id, data.valueId))
      .returning();

    return value;
  }

  async deleteOptionValue(data: { valueId: string; storeId: string }) {
    await this.assertValueOwnership(data.valueId, data.storeId);
    await this.db
      .delete(productOptionValuesTable)
      .where(eq(productOptionValuesTable.id, data.valueId));
    return { message: "Option value deleted" };
  }

  private async assertOptionOwnership(optionId: string, storeId: string) {
    const [row] = await this.db
      .select({ storeId: productsTable.storeId })
      .from(productOptionsTable)
      .innerJoin(productsTable, eq(productOptionsTable.productId, productsTable.id))
      .where(eq(productOptionsTable.id, optionId));

    if (!row || row.storeId !== storeId) throw new NotFoundException("Option not found");
  }

  private async assertValueOwnership(valueId: string, storeId: string) {
    const [row] = await this.db
      .select({ storeId: productsTable.storeId })
      .from(productOptionValuesTable)
      .innerJoin(productOptionsTable, eq(productOptionValuesTable.optionId, productOptionsTable.id))
      .innerJoin(productsTable, eq(productOptionsTable.productId, productsTable.id))
      .where(eq(productOptionValuesTable.id, valueId));

    if (!row || row.storeId !== storeId) throw new NotFoundException("Option value not found");
  }
}
