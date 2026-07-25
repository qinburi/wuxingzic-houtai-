import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { json, urlencoded } from "express";
import { AppModule } from "./app.module.js";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });
  app.setGlobalPrefix("api");
  const allowedOrigins = [process.env.ADMIN_ORIGIN || "http://127.0.0.1:5174", process.env.PORTAL_ORIGIN || "http://127.0.0.1:5173"].flatMap((value) => value.split(","));
  app.enableCors({
    origin: allowedOrigins,
    credentials: false,
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"]
  });
  app.use(json({ limit: "2mb" }));
  app.use(urlencoded({ extended: true, limit: "2mb" }));
  await app.listen(Number(process.env.PORT || 3100), "127.0.0.1");
  console.log(`Hannao asset API: http://127.0.0.1:${process.env.PORT || 3100}/api/health`);
}

void bootstrap();
