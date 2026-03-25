import {
  Injectable,
  Inject,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import { DB_TOKEN, AuditService } from "@sitehaus-ecom/shared";
import { Db, productImagesTable, productsTable } from "@sitehaus-ecom/database";
import { and, eq, max, sql } from "@sitehaus-ecom/database";
import { R2Service } from "@sitehaus-ecom/shared";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 12);

const CONTENT_TYPE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

@Injectable()
export class ImagesHandlerService {
  constructor(
    @Inject(DB_TOKEN) private readonly db: Db,
    private readonly r2: R2Service,
    private readonly audit: AuditService,
  ) {}

  async uploadUrl(data: { productId: string; storeId: string; contentType: string }) {
    const product = await this.db.query.productsTable.findFirst({
      where: (p) => and(eq(p.id, data.productId), eq(p.storeId, data.storeId)),
    });
    if (!product) throw new NotFoundException("Product not found");

    const ext = CONTENT_TYPE_EXT[data.contentType];
    const key = `stores/${data.storeId}/products/${data.productId}/${nanoid()}.${ext}`;

    return this.r2.presignUpload(key, data.contentType, 900);
  }

  async confirm(data: { productId: string; storeId: string; r2Key: string; altText?: string }) {
    const product = await this.db.query.productsTable.findFirst({
      where: (p) => and(eq(p.id, data.productId), eq(p.storeId, data.storeId)),
    });
    if (!product) throw new NotFoundException("Product not found");

    // IDOR guard — key must belong to this store + product
    const expectedPrefix = `stores/${data.storeId}/products/${data.productId}/`;
    if (!data.r2Key.startsWith(expectedPrefix)) {
      throw new NotFoundException("Image not found");
    }

    // max 20 images per product
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(productImagesTable)
      .where(
        and(
          eq(productImagesTable.productId, data.productId),
          eq(productImagesTable.storeId, data.storeId),
        ),
      );

    if (count >= 20) {
      throw new UnprocessableEntityException("Maximum of 20 images per product reached");
    }

    // sortOrder = max existing + 1
    const [{ maxOrder }] = await this.db
      .select({ maxOrder: max(productImagesTable.sortOrder) })
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, data.productId));

    const sortOrder = (maxOrder ?? -1) + 1;
    const cdnUrl = this.r2.cdnUrlFor(data.r2Key);

    const [image] = await this.db
      .insert(productImagesTable)
      .values({
        productId: data.productId,
        storeId: data.storeId,
        r2Key: data.r2Key,
        cdnUrl,
        altText: data.altText ?? null,
        sortOrder,
      })
      .returning();

    await this.audit.log({
      storeId: data.storeId,
      action: "image.confirmed",
      targetType: "product",
      targetId: data.productId,
      meta: { r2Key: data.r2Key },
    });

    return image;
  }

  async delete(data: { productId: string; storeId: string; imageId: string }) {
    const image = await this.db.query.productImagesTable.findFirst({
      where: (i) =>
        and(eq(i.id, data.imageId), eq(i.productId, data.productId), eq(i.storeId, data.storeId)),
    });
    if (!image) throw new NotFoundException("Image not found");

    await this.r2.delete(image.r2Key);

    await this.db.delete(productImagesTable).where(eq(productImagesTable.id, data.imageId));

    // if hero image was deleted, shift remaining down
    if (image.sortOrder === 0) {
      await this.db
        .update(productImagesTable)
        .set({ sortOrder: sql`${productImagesTable.sortOrder} - 1` })
        .where(eq(productImagesTable.productId, data.productId));
    }

    await this.audit.log({
      storeId: data.storeId,
      action: "image.deleted",
      targetType: "product",
      targetId: data.productId,
      meta: { imageId: data.imageId },
    });

    return { message: "Image deleted successfully" };
  }

  async reorder(data: {
    productId: string;
    storeId: string;
    items: Array<{ imageId: string; sortOrder: number }>;
  }) {
    const product = await this.db.query.productsTable.findFirst({
      where: (p) => and(eq(p.id, data.productId), eq(p.storeId, data.storeId)),
    });
    if (!product) throw new NotFoundException("Product not found");

    await this.db.transaction(async (tx) => {
      for (const item of data.items) {
        await tx
          .update(productImagesTable)
          .set({ sortOrder: item.sortOrder })
          .where(
            and(
              eq(productImagesTable.id, item.imageId),
              eq(productImagesTable.productId, data.productId),
            ),
          );
      }
    });

    return this.db
      .select()
      .from(productImagesTable)
      .where(eq(productImagesTable.productId, data.productId));
  }
}
