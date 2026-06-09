import { NestFactory } from "@nestjs/core";
import { WorkerModule } from "./worker.module";

async function bootstrap() {
  // Use createApplicationContext since workers don't need to listen to incoming HTTP requests.
  const app = await NestFactory.createApplicationContext(WorkerModule);
  
  console.log("[WORKER SERVICE] NestJS Worker successfully booted and polling BullMQ queues...");
}
bootstrap();
