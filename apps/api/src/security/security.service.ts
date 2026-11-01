import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import bcrypt from 'bcryptjs'
import { createHash } from 'node:crypto'
import { Repository } from 'typeorm'

import { AUTH_CONFIG, SESSION_TTL_SECONDS } from '../auth/auth.constants'
import type { PublicUser } from '../auth/auth.types'
import type { LoginDto } from '../auth/dto/login.dto'
import type { AppConfig } from '../config/app-config'
import { User } from '../database/entities/user.entity'
import { ConsoleMailer } from './console-mailer'
import { LoginRateLimiter } from './login-rate-limiter'
import { PurposeTokenService } from './purpose-token.service'
import { RESET_PURPOSE, VERIFY_PURPOSE } from './security.constants'
import { generateTotpSecret, totpUri, verifyTotp } from './totp'

const BCRYPT_ROUNDS = 10

export function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export class TooManyAttemptsException extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many attempts. Try again later.')
  }
}

export interface MfaChallenge {
  challenge: string
}

export interface MfaEnrollment {
  secret: string
  otpauthUri: string
}

export interface LoginResult {
  token?: string
  user?: PublicUser
  mfa?: MfaChallenge
}

/**
 * Account security flows: rate-limited login with optional TOTP second
 * factor, single-use email verification and password reset links, and MFA
 * enrollment. Session issues live in AuthService; this module never clears
 * cookies and only returns values for the controller to set.
 */
@Injectable()
export class SecurityService {
  private readonly limiter: LoginRateLimiter

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    private readonly tokens: PurposeTokenService,
    private readonly mailer: ConsoleMailer,
    @Inject(AUTH_CONFIG) private readonly config: AppConfig,
  ) {
    this.limiter = new LoginRateLimiter(
      this.config.loginRateLimitMax,
      this.config.loginRateLimitWindowMinutes * 60_000,
    )
  }

  async login(dto: LoginDto, ip: string): Promise<LoginResult> {
    const email = dto.email.trim().toLowerCase()
    if (!this.limiter.allow(email, ip)) {
      throw new TooManyAttemptsException(Math.ceil(this.limiter.remainingMs(email, ip) / 1000))
    }

    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .addSelect('user.mfaSecret')
      .addSelect('user.mfaConfirmed')
      .where('user.email = :email', { email })
      .getOne()

    // Compare against a real hash even for unknown emails to keep timing similar.
    const hash = user?.passwordHash ?? '$2b$10$ueCoiVWJhd.nVG7ReHewvetcTRlnM3R.4T1B3pKRLN1XJqRdFVl/6'
    const matches = await bcrypt.compare(dto.password, hash)
    if (!user?.passwordHash || !matches) {
      this.limiter.fail(email, ip)
      throw new UnauthorizedException('Email or password is incorrect.')
    }

    this.limiter.reset(email, ip)

    if (user.mfaSecret && user.mfaConfirmed) {
      return { mfa: { challenge: await this.signChallenge(user.id) } }
    }

    return this.finalizeLogin(user)
  }

  /**
   * Exchanges a short-lived MFA challenge plus a valid TOTP code for a full
   * session. The same 30-second step is never accepted twice.
   */
  async verifyMfa(challenge: string, code: string): Promise<LoginResult> {
    let userId: string
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string; purpose?: string }>(challenge, {
        secret: `${this.config.authSecret}:mfa_challenge`,
      })
      if (payload.purpose !== 'mfa' || !payload.sub) throw new Error('wrong purpose')
      userId = payload.sub
    } catch {
      throw new UnauthorizedException('This sign-in attempt expired. Start again.')
    }

    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.mfaSecret')
      .addSelect('user.mfaConfirmed')
      .addSelect('user.mfaLastUsedAt')
      .where('user.id = :id', { id: userId })
      .getOne()

    if (!user?.mfaSecret || !user.mfaConfirmed) {
      throw new UnauthorizedException('This sign-in attempt expired. Start again.')
    }

    if (!verifyTotp(user.mfaSecret, code, user.mfaLastUsedAt)) {
      throw new UnauthorizedException('That code is not valid right now. Try the next one.')
    }

    user.mfaLastUsedAt = new Date()
    await this.users.save(user)
    return this.finalizeLogin(user)
  }

  /** Starts password reset without revealing whether the account exists. */
  async requestPasswordReset(email: string, ip: string): Promise<void> {
    const key = `reset:${email.trim().toLowerCase()}`
    if (!this.limiter.allow(key, ip)) {
      throw new TooManyAttemptsException(Math.ceil(this.limiter.remainingMs(key, ip) / 1000))
    }
    this.limiter.fail(key, ip)

    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: email.trim().toLowerCase() })
      .getOne()
    if (!user || !user.passwordHash) return

    const token = await this.tokens.signResetToken(user.id, user.email)
    user.resetTokenFingerprint = tokenFingerprint(token)
    await this.users.save(user)
    this.mailer.send({
      to: user.email,
      subject: 'Reset your ShareBasket password',
      lines: [
        'Someone requested a password reset for your account.',
        'The link works for 30 minutes and can be used once.',
      ],
      actionUrl: `${this.config.publicWebUrl}/reset-password?token=${encodeURIComponent(token)}`,
      actionLabel: 'Reset link',
    })
  }

  async resetPassword(token: string | undefined, password: string): Promise<void> {
    if (!token) throw new BadRequestException('This reset link is not valid.')
    const user = await this.userForToken(token, RESET_PURPOSE)
    if (!user) throw new BadRequestException('This reset link has expired or was already used.')
    if (user.passwordHash && (await bcrypt.compare(password, user.passwordHash))) {
      throw new BadRequestException('Choose a password different from the current one.')
    }

    user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
    user.resetTokenFingerprint = null
    await this.users.save(user)
    this.mailer.send({
      to: user.email,
      subject: 'Your ShareBasket password was changed',
      lines: ['Your password was just changed.', 'If this was not you, contact your stewards immediately.'],
      actionUrl: `${this.config.publicWebUrl}/login`,
      actionLabel: 'Sign in',
    })
  }

  async resendVerification(currentUser: PublicUser): Promise<void> {
    const user = await this.users.findOne({ where: { id: currentUser.id } })
    if (!user) throw new NotFoundException('Account not found.')
    if (user.emailVerifiedAt) throw new ConflictException('This email is already verified.')
    await this.sendVerification(user)
  }

  /** Freshly registered accounts get their first link through this path. */
  async sendVerificationByUserId(userId: string): Promise<void> {
    const user = await this.users.findOne({ where: { id: userId } })
    if (!user) return
    if (user.emailVerifiedAt) return
    await this.sendVerification(user)
  }

  /** Verification email for accounts created locally (unverified on register). */
  async sendVerification(user: User): Promise<void> {
    const token = await this.tokens.signVerifyToken(user.id, user.email)
    user.verifyTokenFingerprint = tokenFingerprint(token)
    await this.users.save(user)
    this.mailer.send({
      to: user.email,
      subject: 'Verify your ShareBasket email',
      lines: ['Confirm this address to finish setting up your account.'],
      actionUrl: `${this.config.publicWebUrl}/verify-email?token=${encodeURIComponent(token)}`,
      actionLabel: 'Verify link',
    })
  }

  async verifyEmail(token: string | undefined): Promise<void> {
    if (!token) throw new BadRequestException('This verification link is not valid.')
    const user = await this.userForToken(token, VERIFY_PURPOSE)
    if (!user) throw new BadRequestException('This verification link has expired or was already used.')
    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = new Date()
      user.verifyTokenFingerprint = null
      await this.users.save(user)
    }
  }

  async emailStatus(currentUser: PublicUser): Promise<{ verified: boolean }> {
    const user = await this.users.findOne({ where: { id: currentUser.id } })
    if (!user) throw new NotFoundException('Account not found.')
    return { verified: Boolean(user.emailVerifiedAt) }
  }

  async mfaStatus(currentUser: PublicUser): Promise<{ enabled: boolean }> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.mfaSecret')
      .addSelect('user.mfaConfirmed')
      .where('user.id = :id', { id: currentUser.id })
      .getOne()
    return { enabled: Boolean(user?.mfaSecret && user.mfaConfirmed) }
  }

  /** Stages a fresh secret; login does not require it until confirm. */
  async startMfaEnrollment(currentUser: PublicUser): Promise<MfaEnrollment> {
    const user = await this.findUserForMfa(currentUser.id)
    if (user.mfaSecret && user.mfaConfirmed) {
      throw new ConflictException('MFA is already enabled for this account.')
    }
    const secret = generateTotpSecret()
    await this.users.update(user.id, { mfaSecret: secret, mfaConfirmed: false, mfaLastUsedAt: null })
    return { secret, otpauthUri: totpUri(secret, user.email, 'ShareBasket') }
  }

  async confirmMfaEnrollment(currentUser: PublicUser, code: string): Promise<void> {
    const user = await this.findUserForMfa(currentUser.id)
    if (user.mfaSecret && user.mfaConfirmed) {
      throw new ConflictException('MFA is already enabled for this account.')
    }
    if (!user.mfaSecret) throw new BadRequestException('Start MFA setup before confirming it.')

    if (!verifyTotp(user.mfaSecret, code, null)) {
      throw new BadRequestException('That code is not valid right now. Try the next one.')
    }
    await this.users.update(user.id, { mfaConfirmed: true, mfaLastUsedAt: null })
  }

  async disableMfa(currentUser: PublicUser, code: string): Promise<void> {
    const user = await this.findUserForMfa(currentUser.id)
    if (!user.mfaSecret || !user.mfaConfirmed) {
      throw new ConflictException('MFA is not enabled for this account.')
    }
    if (!verifyTotp(user.mfaSecret, code, user.mfaLastUsedAt)) {
      throw new BadRequestException('That code is not valid right now. Try the next one.')
    }
    await this.users.update(user.id, { mfaSecret: null, mfaConfirmed: false, mfaLastUsedAt: null })
  }

  private async findUserForMfa(id: string): Promise<User> {
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.mfaSecret')
      .addSelect('user.mfaConfirmed')
      .where('user.id = :id', { id })
      .getOne()
    if (!user) throw new NotFoundException('Account not found.')
    return user
  }

  private async userForToken(token: string, purpose: string): Promise<User | null> {
    const payload = await this.tokens.consume(token, purpose, null)
    if (!payload) return null
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.verifyTokenFingerprint')
      .addSelect('user.resetTokenFingerprint')
      .where('user.id = :id', { id: payload.sub })
      .getOne()
    if (!user) return null

    const fingerprint = tokenFingerprint(token)
    const expected = purpose === RESET_PURPOSE ? user.resetTokenFingerprint : user.verifyTokenFingerprint
    if (!expected || expected !== fingerprint) return null
    return user
  }

  private async signChallenge(userId: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, purpose: 'mfa' },
      { secret: `${this.config.authSecret}:mfa_challenge`, expiresIn: 180 },
    )
  }

  private async finalizeLogin(user: User): Promise<LoginResult> {
    const payload = { sub: user.id, email: user.email, name: user.name }
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.authSecret,
      expiresIn: SESSION_TTL_SECONDS,
    })
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        provider: user.oauthProvider,
        createdAt: new Date(user.createdAt).toISOString(),
      },
    }
  }
}
