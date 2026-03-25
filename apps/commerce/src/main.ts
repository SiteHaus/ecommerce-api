import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { MicroserviceOptions, Transport } from "@nestjs/microservices";
import "reflect-metadata";
import { AppModule } from "./app.module";
import { HttpToRpcExceptionFilter } from "./filters/http-to-rpc.filter";

async function bootstrap() {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    transport: Transport.TCP,
    options: { host: "0.0.0.0", port: 7021 },
  });

  app.useGlobalFilters(new HttpToRpcExceptionFilter());

  await app.listen();
  Logger.log("Commerce service listening on :7021", "Bootstrap");
}

bootstrap();
