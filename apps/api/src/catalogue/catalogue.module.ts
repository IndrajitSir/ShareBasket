import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'

import { CategoriesController, ProductsController } from './catalogue.controller'
import { CatalogueService } from './catalogue.service'
import { Category } from '../database/entities/category.entity'
import { Product } from '../database/entities/product.entity'

@Module({
  imports: [TypeOrmModule.forFeature([Product, Category])],
  controllers: [ProductsController, CategoriesController],
  providers: [CatalogueService],
  exports: [CatalogueService],
})
export class CatalogueModule {}
