import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { VersioningType, Logger } from "@nestjs/common";
import { SwaggerModule } from "@nestjs/swagger";
import { generateOpenApi } from "@ts-rest/open-api";
import { contract } from "@sitehaus-ecom/contracts";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

function hasOpenApiTags(
  metadata: unknown,
): metadata is { openApiTags: string[] } {
  return (
    !!metadata &&
    typeof metadata === "object" &&
    "openApiTags" in metadata &&
    Array.isArray((metadata as Record<string, unknown>)["openApiTags"])
  );
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Raw body required to forward Stripe webhook payload to payments service
    rawBody: true,
  });

  // Trust reverse proxy headers (X-Forwarded-For etc.) — required for rate limiting by real IP
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cookieParser());

  // All routes are versioned: /v1/...
  app.enableVersioning({ type: VersioningType.URI });

  // TODO SIT-70: load allowed origins from store domains at startup
  app.enableCors({ origin: true, credentials: true });

  // Swagger — spec generated from ts-rest contracts (internal/admin use only)
  const document = generateOpenApi(
    contract,
    {
      info: {
        title: "SiteHaus Commerce API",
        description: "Multi-tenant ecommerce API",
        version: "1.0.0",
      },
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    {
      setOperationId: false,
      operationMapper: (operation, appRoute) => ({
        ...operation,
        ...(hasOpenApiTags(appRoute.metadata)
          ? { tags: appRoute.metadata.openApiTags }
          : {}),
      }),
    },
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SwaggerModule.setup("docs", app, document as any);

  const port = process.env.PORT ?? 7020;
  await app.listen(port);

  Logger.log(`Gateway running on :${port}`, "Bootstrap");
  Logger.log(`Swagger docs at http://localhost:${port}/docs`, "Bootstrap");
}

bootstrap();
