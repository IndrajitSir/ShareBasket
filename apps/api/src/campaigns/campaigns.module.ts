import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { CampaignsController } from './campaigns.controller'
import { CampaignsService } from './campaigns.service'
import { Campaign } from '../database/entities/campaign.entity'
import { RecommendationsModule } from '../recommendations/recommendations.module'

@Module({
  imports: [TypeOrmModule.forFeature([Campaign]), AuthModule, RecommendationsModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
