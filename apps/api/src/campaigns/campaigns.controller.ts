import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'

import { CampaignsService, toCampaignPreview } from './campaigns.service'
import { ListCampaignsQuery } from './dto/list-campaigns.query'
import { QuoteDto } from './dto/quote.dto'

@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

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
  async quote(@Param('slug') slug: string, @Body() body: QuoteDto) {
    return { quote: await this.campaigns.quote(slug, body.quantity), previewOnly: true }
  }
}
