import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "@nestjs/common";
import { getQueueToken } from "@nestjs/bullmq";
import { AppModule } from "./app.module";

async function bootstrap() {
  // No HTTP server, no TCP listener — pure background job processor
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.init();
  Logger.log("Worker started", "Bootstrap");

  // Register repeatable jobs on startup. BullMQ deduplicates by repeat key
  // so restarting the worker won't create duplicate schedules.
  const inventoryQueue = app.get(getQueueToken("ecom-inventory"));
  await inventoryQueue.add(
    "reservation.expire",
    {},
    {
      repeat: { pattern: "* * * * *" }, // every minute
      removeOnComplete: 10,
      removeOnFail: 50,
    },
  );

  const ordersQueue = app.get(getQueueToken("ecom-orders"));
  await ordersQueue.add(
    "cart.expire",
    {},
    {
      repeat: { pattern: "0 3 * * *" }, // daily 3am UTC
      removeOnComplete: 5,
      removeOnFail: 10,
    },
  );
  await ordersQueue.add(
    "order.expire",
    {},
    {
      repeat: { pattern: "15 3 * * *" }, // daily 3:15am UTC (offset from cart.expire 3:00)
      removeOnComplete: 5,
      removeOnFail: 10,
    },
  );

  const catalogQueue = app.get(getQueueToken("ecom-catalog"));
  await catalogQueue.add(
    "catalog.publish-scheduled",
    {},
    {
      repeat: { pattern: "* * * * *" }, // every minute
      removeOnComplete: 10,
      removeOnFail: 50,
    },
  );

  const analyticsQueue = app.get(getQueueToken("ecom-analytics"));
  await analyticsQueue.add(
    "analytics.purgeExpired",
    {},
    {
      repeat: { pattern: "0 2 * * *" }, // daily 2am UTC
      removeOnComplete: 5,
      removeOnFail: 10,
    },
  );

  Logger.log("Repeatable jobs registered", "Bootstrap");
}

bootstrap();
