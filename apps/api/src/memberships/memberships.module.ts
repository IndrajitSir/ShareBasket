import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { Campaign } from '../database/entities/campaign.entity'
import { SocietyMembership } from '../database/entities/society-membership.entity'
import { Society } from '../database/entities/society.entity'
import { MembershipsController } from './memberships.controller'
import { MembershipsService } from './memberships.service'

@Module({
  imports: [TypeOrmModule.forFeature([SocietyMembership, Society, Campaign]), AuthModule],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  exports: [MembershipsService],
})
export class MembershipsModule {}
