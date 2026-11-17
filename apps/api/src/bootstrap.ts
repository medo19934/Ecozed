import { type INestApplication, VersioningType } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { cleanupOpenApiDoc } from 'nestjs-zod';
import { AppConfig } from './config/app-config.service';

/** Shared app configuration for main.ts and e2e tests. */
export function configureApp(app: INestApplication): INestApplication {
  const config = app.get(AppConfig);
  app.use(helmet());
  app.enableCors({
    origin: config
      .get('CORS_ORIGINS')
      .split(',')
      .map((s) => s.trim()),
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();
  return app;
}

export function setupSwagger(app: INestApplication): void {
  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Latif Kids API')
      .setDescription('Multi-tenant daycare management API')
      .setVersion('1.0')
      .addBearerAuth()
      .build(),
  );
  SwaggerModule.setup('api/docs', app, cleanupOpenApiDoc(doc));
}
