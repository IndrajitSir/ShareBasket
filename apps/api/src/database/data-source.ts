import 'dotenv/config'

import { DataSource } from 'typeorm'

import { loadConfig } from '../config/app-config'
import { buildDataSourceOptions } from './database-options'

const config = loadConfig()
export const AppDataSource = new DataSource(buildDataSourceOptions(config))

export { entities, migrations } from './database-options'
