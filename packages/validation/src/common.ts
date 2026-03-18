import { z } from "zod";

export const apiError = z.object({
  message: z.string(),
});

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const uuidParam = z.object({
  id: z.uuid(),
});
