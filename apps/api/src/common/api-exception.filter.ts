import {
  ArgumentsHost,
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ExceptionFilter,
} from '@nestjs/common'
import type { Request, Response } from 'express'

import { CampaignClosedError, QuoteValidationError } from '../campaigns/campaign-pricing'

interface ErrorBody {
  statusCode: number
  code: string
  message: string
  details?: unknown
  requestId?: string
}

const CODE_BY_STATUS: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE',
  429: 'RATE_LIMITED',
  503: 'SERVICE_UNAVAILABLE',
}

/**
 * Single error shape for every response. Domain errors are mapped explicitly;
 * unexpected errors never leak stack traces, SQL or provider details.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp()
    const response = context.getResponse<Response>()
    const request = context.getRequest<Request & { requestId?: string }>()
    const requestId = request.requestId
    let body: ErrorBody

    if (exception instanceof QuoteValidationError) {
      body = { statusCode: 400, code: 'VALIDATION_ERROR', message: exception.message, requestId }
    } else if (exception instanceof CampaignClosedError) {
      body = { statusCode: 409, code: 'CAMPAIGN_CLOSED', message: exception.message, requestId }
    } else if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const payload = exception.getResponse()
      const payloadObject = typeof payload === 'object' ? (payload as Record<string, unknown>) : null
      const payloadMessage = payloadObject?.message
      const message =
        typeof payloadMessage === 'string'
          ? payloadMessage
          : Array.isArray(payloadMessage)
            ? 'Request validation failed.'
            : exception.message
      const details = payloadObject?.details ?? (Array.isArray(payloadMessage) ? payloadMessage : undefined)
      body = {
        statusCode: status,
        code: CODE_BY_STATUS[status] ?? (status >= 500 ? 'INTERNAL_ERROR' : 'ERROR'),
        message,
        requestId,
        ...(details === undefined ? {} : { details }),
      }
    } else {
      this.logger.error(
        `Unhandled error for ${request.method} ${request.originalUrl}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
      body = {
        statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        code: 'INTERNAL_ERROR',
        message: 'Unexpected server error.',
        requestId,
      }
    }

    if (body.statusCode >= 500) {
      this.logger.error(`${request.method} ${request.originalUrl} -> ${body.statusCode} ${body.code} (${requestId})`)
    }

    response.status(body.statusCode).json(body)
  }
}
