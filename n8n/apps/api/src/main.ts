import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { ValidationPipe } from "@nestjs/common";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS for our Next.js visual dashboard connection.
  // origin:"*" + credentials:true is rejected by browsers — must use explicit origins.
  const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // Allow server-to-server calls (no origin header) and listed origins
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} not allowed by CORS`));
      }
    },
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
    credentials: true,
  });

  // Enable strict Zod / DTO request formatting
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    })
  );

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`[API SERVER] NestJS server successfully booted and listening on port ${port}`);
}
bootstrap();
