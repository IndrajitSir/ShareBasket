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

  /**
   * Null until the account confirms an address. Local accounts created through
   * the register endpoint start unverified; OAuth identities from providers
   * that guarantee a verified address are marked verified at creation.
   */
  @Column({ name: 'email_verified_at', type: Date, nullable: true })
  emailVerifiedAt: Date | null

  /**
   * Base32 TOTP secret for optional MFA. Null means second-factor is off. A
   * staged (unconfirmed) secret does not gate login.
   */
  @Column({ name: 'mfa_secret', type: 'varchar', length: 64, nullable: true, select: false })
  mfaSecret: string | null

  /** False while enrollment is staged; set at confirm time. */
  @Column({ name: 'mfa_confirmed', type: 'boolean', default: false, select: false })
  mfaConfirmed: boolean

  /** Set when the most recent TOTP code is accepted; codes do not repeat. */
  @Column({ name: 'mfa_last_used_at', type: Date, nullable: true, select: false })
  mfaLastUsedAt: Date | null

  /** SHA-256 of the newest unexpired verify link; older links stop working. */
  @Column({ name: 'verify_token_fingerprint', type: 'varchar', length: 64, nullable: true, select: false })
  verifyTokenFingerprint: string | null

  /** Same idea for reset links; the fingerprint clears once consumed. */
  @Column({ name: 'reset_token_fingerprint', type: 'varchar', length: 64, nullable: true, select: false })
  resetTokenFingerprint: string | null

  @CreateDateColumn({ name: 'created_at', type: Date })
  createdAt: Date

  @UpdateDateColumn({ name: 'updated_at', type: Date })
  updatedAt: Date
}
