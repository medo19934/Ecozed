import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './bootstrap';
import { AppConfig } from './config/app-config.service';

async function main(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  setupSwagger(app);
  const port = app.get(AppConfig).get('API_PORT');
  await app.listen(port);
  Logger.log(`API on http://localhost:${port}/api/v1 — docs at /api/docs`, 'Bootstrap');
}

void main();
