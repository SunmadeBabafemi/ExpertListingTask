import {
  type INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { validationExceptionFactory } from './common/validation/validation.exception.js';

/**
 * Global HTTP configuration, shared by main.ts and the e2e tests so tests
 * exercise exactly what production runs.
 */
export function configureApp(app: INestApplication): INestApplication {
  app.use(helmet());
  app.enableCors();
  app.enableShutdownHooks();

  // Routes: /api/v1/listings. Health stays unversioned at /health for probes.
  app.setGlobalPrefix('api', { exclude: ['health'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Property Listings API')
    .setDescription('CRUD and geo search for property listings')
    .setVersion('1.0')
    .build();
  SwaggerModule.setup('docs', app, () =>
    SwaggerModule.createDocument(app, swaggerConfig),
  );

  return app;
}
