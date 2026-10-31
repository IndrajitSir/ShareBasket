import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { loadConfig } from './config/app-config'
import { buildDataSourceOptions } from './database/database-options'
import { AuthModule } from './auth/auth.module'
import { CampaignsModule } from './campaigns/campaigns.module'
import { MembershipsModule } from './memberships/memberships.module'
import { CatalogueModule } from './catalogue/catalogue.module'
import { HealthModule } from './health/health.module'

@Module({
  imports: [
    TypeOrmModule.forRootAsync({ useFactory: () => buildDataSourceOptions(loadConfig()) }),
    AuthModule,
    CatalogueModule,
    CampaignsModule,
    MembershipsModule,
    HealthModule,
  ],
})
export class AppModule {}
