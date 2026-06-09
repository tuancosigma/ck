import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ExecutionsController } from "./executions.controller";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "dev-jwt-secret-key-change-in-production",
      signOptions: { expiresIn: "7d" },
    }),
  ],
  controllers: [ExecutionsController],
})
export class ExecutionsModule {}
