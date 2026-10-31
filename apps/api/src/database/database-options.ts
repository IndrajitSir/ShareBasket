import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { DataSourceOptions } from 'typeorm'

import type { AppConfig } from '../config/app-config'
import { Campaign } from './entities/campaign.entity'
import { CampaignPriceTier } from './entities/campaign-price-tier-detail.entity'
import { CampaignProduct } from './entities/campaign-product.entity'
import { Category } from './entities/category.entity'
import { Product } from './entities/product.entity'
import { Society } from './entities/society.entity'
import { User } from './entities/user.entity'
import { InitSchema1793000000000 } from './migrations/1793000000000-InitSchema'
import { AddUsers1793000000001 } from './migrations/1793000000001-AddUsers'

export const entities = [
  Category,
  Product,
  Society,
  Campaign,
  CampaignProduct,
  CampaignPriceTier,
  User,
]
export const migrations = [InitSchema1793000000000, AddUsers1793000000001]

export function buildDataSourceOptions(config: AppConfig): DataSourceOptions {
  if (config.dbDriver === 'postgres') {
    return {
      type: 'postgres',
      url: config.databaseUrl,
      ssl: config.databaseSsl ? { rejectUnauthorized: false } : false,
      entities,
      migrations,
      synchronize: false,
    }
  }

  const database = config.sqlitePath === ':memory:' ? ':memory:' : resolve(config.sqlitePath)
  if (database !== ':memory:') mkdirSync(dirname(database), { recursive: true })

  return {
    type: 'better-sqlite3',
    database,
    entities,
    migrations,
    synchronize: false,
  }
}
