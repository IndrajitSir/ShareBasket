import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm'

import { Product } from './product.entity'

@Entity('category_master')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ name: 'key', type: 'varchar', length: 40, unique: true })
  key: string

  @Column({ type: 'varchar', length: 80 })
  label: string

  @Column({ type: 'varchar', length: 160 })
  blurb: string

  @Column({ type: 'varchar', length: 255 })
  image: string

  @Column({ name: 'sort_order', type: 'int' })
  sortOrder: number

  @OneToMany(() => Product, (product) => product.category)
  products: Product[]
}
