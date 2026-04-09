import { NestFactory } from "@nestjs/core";
import { Module } from "@nestjs/common";

@Module({})
export class AppModule {}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3001);
  console.log("API is running on: http://localhost:3001");
}
bootstrap();
