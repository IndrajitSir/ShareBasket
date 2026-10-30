import 'dotenv/config'

import { AppDataSource } from './data-source'
import { seedDatabase } from './seed-runner'

async function main(): Promise<void> {
  await AppDataSource.initialize()
  try {
    await AppDataSource.runMigrations()
    const result = await seedDatabase(AppDataSource)
    console.log(
      `Seeded ${result.categories} categories, ${result.products} products and ${result.campaigns} campaigns.`,
    )
  } finally {
    await AppDataSource.destroy()
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error instanceof Error ? error.message : error)
  process.exitCode = 1
})
