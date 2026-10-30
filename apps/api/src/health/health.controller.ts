import { Controller, Get, Res } from '@nestjs/common'
import { DataSource } from 'typeorm'
import type { Response } from 'express'

@Controller('health')
export class HealthController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async check(@Res({ passthrough: true }) response: Response) {
    const startedAt = Date.now()
    try {
      await this.dataSource.query('SELECT 1')
      return {
        status: 'ok',
        database: 'up',
        latencyMs: Date.now() - startedAt,
        uptimeSeconds: Math.round(process.uptime()),
      }
    } catch {
      response.status(503)
      return {
        status: 'degraded',
        database: 'down',
        uptimeSeconds: Math.round(process.uptime()),
      }
    }
  }
}
