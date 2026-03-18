import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { AppModule } from './app.module';

async function bootstrap() {
  // No HTTP server, no TCP listener — pure background job processor
  const app = await NestFactory.createApplicationContext(AppModule);
  await app.init();
  Logger.log('Worker started', 'Bootstrap');

  // Register repeatable jobs on startup. BullMQ deduplicates by repeat key
  // so restarting the worker won't create duplicate schedules.
  const inventoryQueue = app.get(getQueueToken('ecom-inventory'));
  await inventoryQueue.add('reservation.expire', {}, {
    repeat: { pattern: '* * * * *' }, // every minute
    removeOnComplete: 10,
    removeOnFail: 50,
  });

  const ordersQueue = app.get(getQueueToken('ecom-orders'));
  await ordersQueue.add('cart.expire', {}, {
    repeat: { pattern: '0 3 * * *' }, // daily 3am UTC
    removeOnComplete: 5,
    removeOnFail: 10,
  });

  Logger.log('Repeatable jobs registered', 'Bootstrap');
}

bootstrap();
