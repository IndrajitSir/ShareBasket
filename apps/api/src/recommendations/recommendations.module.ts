import { Module, forwardRef } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { CampaignSignal } from '../database/entities/campaign-signal.entity'
import { Campaign } from '../database/entities/campaign.entity'
import { SocietyMembership } from '../database/entities/society-membership.entity'
import { Society } from '../database/entities/society.entity'
import { MembershipsModule } from '../memberships/memberships.module'
import { RecommendationsController } from './recommendations.controller'
import { RecommendationsService } from './recommendations.service'
import { SignalsService } from './signals.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([Campaign, CampaignSignal, SocietyMembership, Society]),
    AuthModule,
    forwardRef(() => MembershipsModule),
  ],
  controllers: [RecommendationsController],
  providers: [RecommendationsService, SignalsService],
  exports: [RecommendationsService, SignalsService],
})
export class RecommendationsModule {}
