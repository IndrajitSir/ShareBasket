import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm'

@Entity('society_master')
export class Society {
  @PrimaryGeneratedColumn('uuid')
  id: string

  @Column({ type: 'varchar', length: 120, unique: true })
  name: string

  @Column({ type: 'varchar', length: 120 })
  location: string
}
