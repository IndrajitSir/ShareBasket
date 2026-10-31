import { Body, Controller, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import type { Request } from 'express'

import type { PublicUser } from '../auth/auth.types'
import { AuthService } from '../auth/auth.service'
import { resolveRequestUser } from '../auth/request-user'
import { SignalsService } from '../recommendations/signals.service'
import { CampaignsService, toCampaignPreview } from './campaigns.service'
import { ListCampaignsQuery } from './dto/list-campaigns.query'
import { QuoteDto } from './dto/quote.dto'

type SessionRequest = Request & { user?: PublicUser }

@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly auth: AuthService,
    private readonly signals: SignalsService,
  ) {}

  @Get()
  async list(@Query() query: ListCampaignsQuery) {
    return { campaigns: await this.campaigns.list(query), previewOnly: true }
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const campaign = await this.campaigns.findOneOrFail(slug)
    return { campaign: toCampaignPreview(campaign), previewOnly: true }
  }

  /** Server-authoritative preview quote; creates no commitment or reservation. */
  @Post(':slug/quote')
  @HttpCode(200)
  async quote(@Req() request: SessionRequest, @Param('slug') slug: string, @Body() body: QuoteDto) {
    const quote = await this.campaigns.quote(slug, body.quantity)

    // Implicit interest may improve recommendations, but a quote must never
    // depend on the signal write succeeding.
    void resolveRequestUser(this.auth, request).then((user) => {
      if (!user) return
      this.signals.recordQuote(user.id, slug, body.quantity).catch((error: unknown) => {
        this.signals.logRecordFailure(slug, error)
      })
    })

    return { quote, previewOnly: true }
  }
}
