import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common'

import { CatalogueService, toProductResponse } from './catalogue.service'
import { ListProductsQuery } from './dto/list-products.query'

@Controller('products')
export class ProductsController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  async list(@Query() query: ListProductsQuery) {
    return this.catalogue.list(query)
  }

  @Get(':slug')
  async detail(@Param('slug') slug: string) {
    const product = await this.catalogue.findBySlug(slug)
    if (!product) throw new NotFoundException('Product not found.')
    return { product: toProductResponse(product) }
  }
}

@Controller('categories')
export class CategoriesController {
  constructor(private readonly catalogue: CatalogueService) {}

  @Get()
  async list() {
    return { categories: await this.catalogue.listCategories() }
  }
}
