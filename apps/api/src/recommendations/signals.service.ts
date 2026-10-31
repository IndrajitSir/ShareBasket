import { Inject, Injectable, Logger } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { CampaignSignal } from '../database/entities/campaign-signal.entity'
import { Campaign } from '../database/entities/campaign.entity'
import { SIGNAL_RATE_LIMITER, SlidingWindowRateLimiter } from './signal-rate-limit'
import { RecommendationSnapshotsService } from './recommendation-snapshots.service'

@Injectable()
export class SignalsService {
  private readonly logger = new Logger(SignalsService.name)

  constructor(
    @InjectRepository(CampaignSignal)
    private readonly signals: Repository<CampaignSignal>,
    @InjectRepository(Campaign) private readonly campaigns: Repository<Campaign>,
    @Inject(SIGNAL_RATE_LIMITER) private readonly limiter: SlidingWindowRateLimiter,
    private readonly snapshots: RecommendationSnapshotsService,
  ) {}

  /**
   * Best-effort implicit interest. A quote is not a commitment or a purchase,
   * and a signal write must never fail the quote request.
   *
   * One row exists per member and campaign, so repeated quotes update the
   * weight rather than adding duplicate evidence.
   */
  async recordQuote(userId: string, campaignSlug: string, quantity: number): Promise<boolean> {
    const campaign = await this.campaigns.findOne({ where: { slug: campaignSlug } })
    if (!campaign) return false

    if (!this.limiter.take(userId)) {
      this.logger.debug('Quote signal skipped: member rate limit exceeded.')
      return false
    }

    const weight = Number.isFinite(quantity) ? Math.max(1, Math.min(20, Math.floor(quantity))) : 1
    await this.signals.upsert(
      {
        userId,
        campaignId: campaign.id,
        signalType: 'QUOTE',
        weight,
      },
      { conflictPaths: ['userId', 'campaignId'] },
    )
    // New co-quote evidence changes affinity and trending. Rebuild lazily in
    // the background; the next read either sees the old or the new snapshot.
    this.snapshots.invalidate()
    return true
  }

  logRecordFailure(campaignSlug: string, error: unknown): void {
    this.logger.warn(
      `Could not record a quote signal for ${campaignSlug}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    )
  }
}
