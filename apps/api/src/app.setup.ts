import { BadRequestException, ValidationPipe, type INestApplication } from '@nestjs/common'
import cookieParser from 'cookie-parser'
import type { NextFunction, Request, Response } from 'express'
import helmet from 'helmet'

import { ApiExceptionFilter } from './common/api-exception.filter'
import { RequestIdMiddleware } from './common/request-id.middleware'

export const API_PREFIX = 'api/v1'

/**
 * Shared application wiring so integration tests exercise the same prefix,
 * validation, CORS and error contract as the deployed server.
 */
export function configureApp(app: INestApplication, options: { corsOrigins: string[] }): void {
  app.setGlobalPrefix(API_PREFIX)
  app.use(helmet({ crossOriginResourcePolicy: false }))
  app.use(cookieParser())

  app.enableCors({
    origin: options.corsOrigins,
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
    exposedHeaders: ['X-Request-Id'],
    credentials: false,
    maxAge: 600,
  })

  const requestIds = new RequestIdMiddleware()
  app.use((request: Request, response: Response, next: NextFunction) =>
    requestIds.use(request, response, next),
  )

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          message: 'Request validation failed.',
          details: errors.map((error) => ({
            field: error.property,
            constraints: Object.values(error.constraints ?? {}),
          })),
        }),
    }),
  )

  app.useGlobalFilters(new ApiExceptionFilter())
}
