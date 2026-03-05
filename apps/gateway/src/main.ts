import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { VersioningType, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Raw body required to forward Stripe webhook payload to payments service
    rawBody: true,
  });

  // Trust reverse proxy headers (X-Forwarded-For etc.) — required for rate limiting by real IP
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cookieParser());

  // All routes are versioned: /v1/...
  app.enableVersioning({ type: VersioningType.URI });

  // TODO SIT-70: load allowed origins from store domains at startup
  app.enableCors({ origin: true, credentials: true });

  // Swagger — internal/admin use only
  const swaggerConfig = new DocumentBuilder()
    .setTitle('SiteHaus Commerce API')
    .setDescription('Multi-tenant ecommerce API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 7020;
  await app.listen(port);

  Logger.log(`Gateway running on :${port}`, 'Bootstrap');
  Logger.log(`Swagger docs at http://localhost:${port}/docs`, 'Bootstrap');
}

bootstrap();
