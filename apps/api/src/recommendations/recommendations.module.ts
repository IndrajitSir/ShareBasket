import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { loadConfig } from '../config/app-config'
import { CampaignSignal } from '../database/entities/campaign-signal.entity'
import { Campaign } from '../database/entities/campaign.entity'
import { SocietyMembership } from '../database/entities/society-membership.entity'
import { RecommendationSnapshotRow } from '../database/entities/recommendation-snapshot.entity'
import { Society } from '../database/entities/society.entity'
import { MembershipsModule } from '../memberships/memberships.module'
import { RecommendationsController } from './recommendations.controller'
import { RecommendationsService } from './recommendations.service'
import {
  RecommendationSnapshotsService,
  SNAPSHOT_TTL_MS,
  SNAPSHOT_TTL_TOKEN,
} from './recommendation-snapshots.service'
import { SignalsService } from './signals.service'
import { SIGNAL_RATE_LIMITER, SlidingWindowRateLimiter } from './signal-rate-limit'

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Campaign,
      CampaignSignal,
      SocietyMembership,
      Society,
      RecommendationSnapshotRow,
    ]),
    AuthModule,
    forwardRef(() => MembershipsModule),
  ],
  controllers: [RecommendationsController],
  providers: [
    {
      provide: SIGNAL_RATE_LIMITER,
      useFactory: () =>
        new SlidingWindowRateLimiter(loadConfig().signalRateLimitPerMinute),
    },
    { provide: SNAPSHOT_TTL_TOKEN, useValue: SNAPSHOT_TTL_MS },
    RecommendationSnapshotsService,
    RecommendationsService,
    SignalsService,
  ],
  exports: [RecommendationsService, RecommendationSnapshotsService, SignalsService],
})
export class RecommendationsModule {}
