import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'
import { randomUUID } from 'node:crypto'

export const REQUEST_ID_HEADER = 'x-request-id'

/**
 * Accepts a caller-supplied request ID only when it looks like an opaque
 * identifier; otherwise generates one. The ID is echoed in the response header
 * and included in error bodies for correlation.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request & { requestId?: string }, response: Response, next: NextFunction): void {
    const incoming = request.header(REQUEST_ID_HEADER)?.trim()
    const requestId = incoming && /^[A-Za-z0-9._:-]{8,128}$/.test(incoming) ? incoming : randomUUID()
    request.requestId = requestId
    response.setHeader('X-Request-Id', requestId)
    next()
  }
}
