import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm'

export type OAuthProvider = 'local' | 'google' | 'github'

@Entity('user_master')
@Index('uq_user_master_email', ['email'], { unique: true })
@Index('uq_user_oauth_identity', ['oauthProvider', 'oauthSubject'], { unique: true })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string

  /** Stored lowercase; uniqueness is the account key. */
  @Column({ type: 'varchar', length: 254 })
  email: string

  @Column({ type: 'varchar', length: 120 })
  name: string

  /** Nullable for OAuth-only accounts. Excluded from ordinary selects. */
  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 100,
    nullable: true,
    select: false,
  })
  passwordHash: string | null

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl: string | null

  @Column({ name: 'oauth_provider', type: 'varchar', length: 20, default: 'local' })
  oauthProvider: OAuthProvider

  @Column({ name: 'oauth_subject', type: 'varchar', length: 191, nullable: true })
  oauthSubject: string | null

  @CreateDateColumn({ name: 'created_at', type: Date })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: Date })
  updatedAt: Date
}
