import { runMigrations } from "@sitehaus-ecom/database/migrate";
import { Logger, VersioningType } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { SwaggerModule } from "@nestjs/swagger";
import { contract } from "@sitehaus-ecom/contracts";
import { generateOpenApi } from "@ts-rest/open-api";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import "reflect-metadata";
import { toJSONSchema } from "zod";
import { AppModule } from "./app.module";
import { StoreService } from "./store/store.service";

function zodV4SchemaTransformer({
  schema,
}: {
  schema: unknown;
  type: string;
  concatenatedPath: string;
}) {
  if (!schema || typeof (schema as any).safeParse !== "function") return null;
  try {
    const { $schema, ...jsonSchema } = toJSONSchema(schema as any) as any;
    return jsonSchema;
  } catch {
    return null;
  }
}

function hasOpenApiTags(metadata: unknown): metadata is { openApiTags: string[] } {
  return (
    !!metadata &&
    typeof metadata === "object" &&
    "openApiTags" in metadata &&
    Array.isArray((metadata as Record<string, unknown>)["openApiTags"])
  );
}

async function bootstrap() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error("DATABASE_URL is required");

  Logger.log("Running database migrations...", "Bootstrap");
  await runMigrations(dbUrl);
  Logger.log("Migrations complete.", "Bootstrap");

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    // Raw body required to forward Stripe webhook payload to payments service
    rawBody: true,
  });

  // Trust reverse proxy headers (X-Forwarded-For etc.) — required for rate limiting by real IP
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cookieParser());

  // Health check — used by Docker, load balancers, and Lighthaus monitoring.
  // Registered before URI versioning so it stays at /health (not /v1/health);
  // returns the ecosystem-standard { status, uptime, version } shape.
  app.use("/health", (_req: unknown, res: { json: (body: unknown) => void }) => {
    res.json({
      status: "ok",
      uptime: Math.floor(process.uptime()),
      version: process.env.APP_VERSION ?? "dev",
    });
  });

  // All routes are versioned: /v1/...
  app.enableVersioning({ type: VersioningType.URI });

  // CORS allow-list (SIT-70). Reflecting any origin alongside credentials lets
  // any site make authenticated requests on a user's behalf, so validate every
  // origin: static env origins + live active store domains. In soak mode
  // (CORS_ENFORCE=false) disallowed origins are logged but still permitted, so
  // we can observe real traffic before enforcing.
  const storeService = app.get(StoreService);
  const staticOrigins = new Set(
    (process.env.CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean),
  );
  const corsEnforce = process.env.CORS_ENFORCE === "true";

  app.enableCors({
    origin: async (origin, cb) => {
      try {
        // No Origin header → non-browser / same-origin request; always allow.
        if (!origin) return cb(null, true);
        if (staticOrigins.has(origin)) return cb(null, true);
        if (await storeService.isActiveStoreOrigin(origin)) return cb(null, true);

        Logger.warn(`Disallowed CORS origin: ${origin}`, "Cors");
        if (corsEnforce) return cb(new Error("Not allowed by CORS"));
        return cb(null, true); // soak mode — permit while observing
      } catch (err) {
        // A failing store lookup (e.g. DB error) must NEVER crash the gateway —
        // an unhandled rejection here previously took the whole process down on
        // every CORS preflight. Log and fail per the soak/enforce policy instead.
        Logger.error(
          `CORS origin check failed for ${origin}: ${err instanceof Error ? err.message : String(err)}`,
          "Cors",
        );
        return corsEnforce ? cb(new Error("Not allowed by CORS")) : cb(null, true);
      }
    },
    credentials: true,
  });

  // Swagger — spec generated from ts-rest contracts (internal/admin use only).
  // Never expose the API surface publicly in production; gate behind NODE_ENV.
  const swaggerEnabled = process.env.NODE_ENV !== "production";
  if (swaggerEnabled) {
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
        setOperationId: true,
        schemaTransformer: zodV4SchemaTransformer,
        operationMapper: (operation, appRoute) => ({
          ...operation,
          ...(hasOpenApiTags(appRoute.metadata) ? { tags: appRoute.metadata.openApiTags } : {}),
        }),
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SwaggerModule.setup("docs", app, document as any);
  }

  const port = process.env.PORT ?? 7020;
  await app.listen(port);

  Logger.log(`Gateway running on :${port}`, "Bootstrap");
  if (swaggerEnabled) {
    Logger.log(`Swagger docs at http://localhost:${port}/docs`, "Bootstrap");
  }
}

bootstrap();
