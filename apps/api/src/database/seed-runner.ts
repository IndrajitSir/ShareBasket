import type { DataSource } from 'typeorm'

import { SEED_CAMPAIGNS, SEED_CATEGORIES, SEED_PRODUCTS } from './seed-data'
import { Campaign } from './entities/campaign.entity'
import { CampaignPriceTier } from './entities/campaign-price-tier-detail.entity'
import { CampaignProduct } from './entities/campaign-product.entity'
import { Category } from './entities/category.entity'
import { Product } from './entities/product.entity'
import { Society } from './entities/society.entity'

/**
 * Idempotent synthetic seed. Running it repeatedly converges on the same
 * catalogue without duplicating rows, and it refuses production by default.
 */
export async function seedDatabase(
  dataSource: DataSource,
  options: { allowProduction?: boolean } = {},
): Promise<{ categories: number; products: number; campaigns: number }> {
  if (process.env.NODE_ENV === 'production' && !options.allowProduction) {
    throw new Error('Refusing to seed production data. Pass allowProduction explicitly.')
  }

  return dataSource.transaction(async (manager) => {
    const categoryRepo = manager.getRepository(Category)
    const productRepo = manager.getRepository(Product)
    const societyRepo = manager.getRepository(Society)
    const campaignRepo = manager.getRepository(Campaign)
    const campaignProductRepo = manager.getRepository(CampaignProduct)
    const tierRepo = manager.getRepository(CampaignPriceTier)

    const categories = new Map<string, Category>()
    for (const seed of SEED_CATEGORIES) {
      const existing = await categoryRepo.findOne({ where: { key: seed.key } })
      const category = categoryRepo.merge(existing ?? categoryRepo.create(), {
        key: seed.key,
        label: seed.label,
        blurb: seed.blurb,
        image: seed.image,
        sortOrder: seed.sortOrder,
      })
      categories.set(seed.key, await categoryRepo.save(category))
    }

    const products = new Map<string, Product>()
    for (const seed of SEED_PRODUCTS) {
      const category = categories.get(seed.categoryKey)
      if (!category) throw new Error(`Seed product ${seed.slug} references an unknown category.`)

      const existing = await productRepo.findOne({ where: { slug: seed.slug } })
      const product = productRepo.merge(existing ?? productRepo.create(), {
        slug: seed.slug,
        name: seed.name,
        categoryId: category.id,
        pricePaise: seed.pricePaise,
        compareAtPaise: seed.compareAtPaise ?? null,
        image: seed.image,
        badge: seed.badge ?? null,
        shortDescription: seed.short,
        description: seed.description,
        details: seed.details,
        materials: seed.materials,
        optionName: seed.options?.name ?? null,
        optionValues: seed.options?.values ?? null,
        featured: seed.featured ?? false,
      })
      products.set(seed.slug, await productRepo.save(product))
    }

    for (const seed of SEED_CAMPAIGNS) {
      const existingSociety = await societyRepo.findOne({ where: { name: seed.society } })
      const society = await societyRepo.save(
        societyRepo.merge(existingSociety ?? societyRepo.create(), {
          name: seed.society,
          location: seed.location,
        }),
      )

      const product = products.get(seed.productSlug)
      if (!product) throw new Error(`Seed campaign ${seed.slug} references an unknown product.`)

      const existing = await campaignRepo.findOne({ where: { slug: seed.slug } })
      const campaign = await campaignRepo.save(
        campaignRepo.merge(existing ?? campaignRepo.create(), {
          slug: seed.slug,
          societyId: society.id,
          unitsCommitted: seed.unitsCommitted,
          minimumUnits: seed.minimumUnits,
          closesAt: new Date(seed.closesAt),
          deliveryDate: seed.deliveryDate,
          status: 'OPEN' as const,
        }),
      )

      const link = await campaignProductRepo.findOne({
        where: { campaignId: campaign.id, productId: product.id },
      })
      if (!link) {
        await campaignProductRepo.save(
          campaignProductRepo.create({ campaignId: campaign.id, productId: product.id }),
        )
      }

      const existingTiers = await tierRepo.find({ where: { campaignId: campaign.id } })
      const wanted = new Set(seed.tiers.map((tier) => tier.minimumUnits))
      for (const seedTier of seed.tiers) {
        const current = existingTiers.find((tier) => tier.minimumUnits === seedTier.minimumUnits)
        await tierRepo.save(
          tierRepo.merge(current ?? tierRepo.create(), {
            campaignId: campaign.id,
            minimumUnits: seedTier.minimumUnits,
            unitPricePaise: seedTier.unitPricePaise,
          }),
        )
      }
      for (const stale of existingTiers) {
        if (!wanted.has(stale.minimumUnits)) await tierRepo.remove(stale)
      }
    }

    return {
      categories: SEED_CATEGORIES.length,
      products: SEED_PRODUCTS.length,
      campaigns: SEED_CAMPAIGNS.length,
    }
  })
}
