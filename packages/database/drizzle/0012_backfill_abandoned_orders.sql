-- Custom SQL migration file, put your code below! --

-- Backfill: every existing `cancelled` order was actually an abandoned,
-- never-paid checkout auto-cleaned by the order.expire worker (the only
-- producer of `cancelled` to date). Reclassify them as `abandoned` so they
-- drop out of the orders list and stop reading as merchant-cancelled orders.
-- Safe in the same transaction as 0011 only because 0011 rebuilds the enum type rather
-- than ALTER TYPE ... ADD VALUE — see the note there before changing either file.
UPDATE "orders" SET "status" = 'abandoned' WHERE "status" = 'cancelled';