import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AuthModule } from '../auth/auth.module'
import { Campaign } from '../database/entities/campaign.entity'
import { SocietyMembership } from '../database/entities/society-membership.entity'
import { Society } from '../database/entities/society.entity'
import { User } from '../database/entities/user.entity'
import { MembershipsController } from './memberships.controller'
import { MembershipsService } from './memberships.service'
import { SocietiesController } from './societies.controller'
import { SocietyScopeGuard } from './society-scope.guard'

@Module({
  imports: [TypeOrmModule.forFeature([SocietyMembership, Society, Campaign, User]), AuthModule],
  controllers: [MembershipsController, SocietiesController],
  providers: [MembershipsService, SocietyScopeGuard],
  exports: [MembershipsService, SocietyScopeGuard],
})
export class MembershipsModule {}
