import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm'

import { Category } from './category.entity'

@Entity('product_master')
@Index('uq_product_master_slug', ['slug'], { unique: true })
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 80 })
  slug: string

  @Column({ type: 'varchar', length: 120 })
  name: string

  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string

  @ManyToOne(() => Category, (category) => category.products, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: Category

  /** Authoritative price in integer paise; never a float. */
  @Column({ name: 'price_paise', type: 'int' })
  pricePaise: number

  @Column({ name: 'compare_at_paise', type: 'int', nullable: true })
  compareAtPaise: number | null

  @Column({ type: 'varchar', length: 255 })
  image: string

  @Column({ type: 'varchar', length: 40, nullable: true })
  badge: string | null

  @Column({ name: 'short_description', type: 'varchar', length: 200 })
  shortDescription: string

  @Column({ type: 'text' })
  description: string

  /** Display-only list of bullet points. */
  @Column({ name: 'details_json', type: 'simple-json' })
  details: string[]

  @Column({ type: 'text' })
  materials: string

  @Column({ name: 'option_name', type: 'varchar', length: 40, nullable: true })
  optionName: string | null

  @Column({ name: 'option_values_json', type: 'simple-json', nullable: true })
  optionValues: string[] | null

  @Column({ type: 'boolean' })
  featured: boolean

  @CreateDateColumn({ name: 'created_at', type: Date })
  createdAt: Date
}
