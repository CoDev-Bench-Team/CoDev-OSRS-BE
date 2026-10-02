import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import {
  ProblemDetailsFilter,
  toValidationProblemDetails,
} from './common/problem-details.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  app.useGlobalFilters(new ProblemDetailsFilter(app.get(HttpAdapterHost)));

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      exceptionFactory: (errors) => toValidationProblemDetails(errors),
    }),
  );

  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : true;

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CoDev OSRS API')
    .setDescription(
      'API documentation for the CoDev Office Supplies Request System backend',
    )
    .setVersion('1.0')
    .addCookieAuth('session', {
      type: 'apiKey',
      in: 'cookie',
      name: 'session',
    })
    .addTag(
      'CoDev OSRS',
      'Office-supplies request and inventory management API.',
    )
    .addTag(
      'Auth',
      'Google Workspace sign-in, session-cookie management, and the current-user session endpoint.',
    )
    .addTag(
      'Assets',
      'Catalog definitions for office equipment, including specifications, low-stock thresholds, and available stock counts.',
    )
    .addTag(
      'Inventory Items',
      'Individual physical units linked to catalog assets, tracked by serial number, location, assignment, and availability status.',
    )
    .addTag(
      'Requests',
      'Employee equipment requests with stock reservation, administrative review, fulfillment status transitions, and request history.',
    )
    .addTag(
      'Users',
      'User accounts, roles, and office locations used for authentication, assignment, and request review.',
    )
    .build();
  const documentFactory = () =>
    SwaggerModule.createDocument(app, swaggerConfig);
  const swaggerUiCdn = 'https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.14';
  const swaggerAssets = [
    'swagger-ui.css',
    'swagger-ui-bundle.js',
    'swagger-ui-standalone-preset.js',
    'favicon-16x16.png',
    'favicon-32x32.png',
  ];

  for (const asset of swaggerAssets) {
    app.getHttpAdapter().get(`/${asset}`, (_request, response) => {
      response.redirect(`${swaggerUiCdn}/${asset}`);
    });
  }

  SwaggerModule.setup('/', app, documentFactory);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
