import { Injectable } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'

import { formatPaise } from '../campaigns/campaign-pricing'
import type { ListProductsQuery } from './dto/list-products.query'
import { Category } from '../database/entities/category.entity'
import { Product } from '../database/entities/product.entity'

export function toProductResponse(product: Product) {
  return {
    slug: product.slug,
    name: product.name,
    category: product.category?.key ?? null,
    categoryLabel: product.category?.label ?? null,
    pricePaise: product.pricePaise,
    price: formatPaise(product.pricePaise),
    compareAtPaise: product.compareAtPaise,
    compareAt: product.compareAtPaise === null ? null : formatPaise(product.compareAtPaise),
    image: product.image,
    badge: product.badge,
    short: product.shortDescription,
    description: product.description,
    details: product.details,
    materials: product.materials,
    options:
      product.optionName && product.optionValues
        ? { name: product.optionName, values: product.optionValues }
        : null,
    featured: product.featured,
  }
}

@Injectable()
export class CatalogueService {
  constructor(
    @InjectRepository(Product) private readonly products: Repository<Product>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
  ) {}

  async listCategories() {
    const rows = await this.categories
      .createQueryBuilder('category')
      .leftJoin('category.products', 'product')
      .select(['category.id', 'category.key', 'category.label', 'category.blurb', 'category.image', 'category.sortOrder'])
      .addSelect('COUNT(product.id)', 'productCount')
      .groupBy('category.id')
      .orderBy('category.sortOrder', 'ASC')
      .getRawAndEntities()

    const counts = new Map<string, number>(
      rows.raw.map((row: { category_id: string; productCount: string | number }) => [
        row.category_id,
        Number(row.productCount),
      ]),
    )

    return rows.entities.map((category) => ({
      key: category.key,
      label: category.label,
      blurb: category.blurb,
      image: category.image,
      productCount: counts.get(category.id) ?? 0,
    }))
  }

  async list(query: ListProductsQuery) {
    const limit = query.limit ?? 24
    const offset = query.offset ?? 0
    const builder = this.products
      .createQueryBuilder('product')
      .innerJoinAndSelect('product.category', 'category')
      .where('1 = 1')

    if (query.category) builder.andWhere('category.key = :category', { category: query.category })
    if (query.minPricePaise !== undefined) {
      builder.andWhere('product.pricePaise >= :minPrice', { minPrice: query.minPricePaise })
    }
    if (query.maxPricePaise !== undefined) {
      builder.andWhere('product.pricePaise <= :maxPrice', { maxPrice: query.maxPricePaise })
    }

    switch (query.sort) {
      case 'price-asc':
        builder.orderBy('product.pricePaise', 'ASC')
        break
      case 'price-desc':
        builder.orderBy('product.pricePaise', 'DESC')
        break
      case 'new':
        builder.orderBy('product.createdAt', 'DESC').addOrderBy('product.name', 'ASC')
        break
      default:
        builder.orderBy('product.featured', 'DESC').addOrderBy('product.name', 'ASC')
    }

    const [items, total] = await builder.skip(offset).take(limit).getManyAndCount()

    return {
      items: items.map(toProductResponse),
      page: { limit, offset, total },
    }
  }

  async findBySlug(slug: string) {
    return this.products.findOne({ where: { slug }, relations: { category: true } })
  }
}
