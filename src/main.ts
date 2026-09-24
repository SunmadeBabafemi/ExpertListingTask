import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { configureApp } from './app.setup.js';

async function bootstrap() {
  const app = configureApp(await NestFactory.create(AppModule));
  const port = app.get(ConfigService).get<number>('PORT', 3000);
  await app.listen(port);
  Logger.log(
    `Listening on http://localhost:${port} (docs at /docs)`,
    'Bootstrap',
  );
}
await bootstrap();
