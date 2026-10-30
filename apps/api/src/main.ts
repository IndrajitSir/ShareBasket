import 'dotenv/config'

import { Logger } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { DataSource } from 'typeorm'

import { AppModule } from './app.module'
import { API_PREFIX, configureApp } from './app.setup'
import { loadConfig } from './config/app-config'
import { seedDatabase } from './database/seed-runner'

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap')
  const config = loadConfig()
  const app = await NestFactory.create(AppModule)

  configureApp(app, { corsOrigins: config.corsOrigins })

  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('ShareBasket API')
        .setDescription('Read-only catalogue, campaign and quote endpoints (preview data).')
        .setVersion('0.1.0')
        .build(),
    )
    SwaggerModule.setup('api/docs', app, document)
  }

  const dataSource = app.get(DataSource)
  if (config.migrateOnBoot) {
    logger.log('Running pending migrations (MIGRATE_ON_BOOT=true).')
    await dataSource.runMigrations()
  }
  if (config.seedOnBoot) {
    const result = await seedDatabase(dataSource, { allowProduction: config.seedAllowProduction })
    logger.log(
      `Seeded ${result.products} products and ${result.campaigns} campaigns (SEED_ON_BOOT=true).`,
    )
  }

  await app.listen(config.port, '0.0.0.0')
  logger.log(`API listening on http://0.0.0.0:${config.port}/${API_PREFIX}`)
}

bootstrap().catch((error: unknown) => {
  // Logger is available only after Nest starts; this failure path is pre-listen.
  console.error('API failed to start:', error instanceof Error ? error.message : error)
  process.exit(1)
})
