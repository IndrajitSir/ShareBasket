import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { InjectRepository } from '@nestjs/typeorm'
import bcrypt from 'bcryptjs'
import { Repository } from 'typeorm'

import { AUTH_CONFIG, SESSION_TTL_SECONDS } from './auth.constants'
import type { OAuthProfile, PublicUser } from './auth.types'
import type { LoginDto } from './dto/login.dto'
import type { RegisterDto } from './dto/register.dto'
import type { AppConfig } from '../config/app-config'
import { User } from '../database/entities/user.entity'

const BCRYPT_ROUNDS = 10
const GENERIC_LOGIN_ERROR = 'Email or password is incorrect.'

interface SessionPayload {
  sub: string
  email: string
  name: string
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    provider: user.oauthProvider,
    createdAt: new Date(user.createdAt).toISOString(),
  }
}

function isUniqueViolation(error: unknown): boolean {
  const candidate = error as { code?: string; driverError?: { code?: string } }
  const code = candidate.driverError?.code ?? candidate.code
  return code === '23505' || code === 'SQLITE_CONSTRAINT' || code === 'SQLITE_CONSTRAINT_UNIQUE'
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AppConfig,
  ) {}

  async register(dto: RegisterDto): Promise<{ token: string; user: PublicUser }> {
    const email = dto.email.trim().toLowerCase()
    const existing = await this.users.findOne({ where: { email } })
    if (existing) {
      throw new ConflictException('An account with this email already exists.')
    }

    const user = this.users.create({
      email,
      name: dto.name,
      passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      avatarUrl: null,
      oauthProvider: 'local',
      oauthSubject: null,
    })

    try {
      await this.users.save(user)
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('An account with this email already exists.')
      }
      throw error
    }

    return this.issueSession(user)
  }

  async login(dto: LoginDto): Promise<{ token: string; user: PublicUser }> {
    const email = dto.email.trim().toLowerCase()
    const user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne()

    // Compare against a real hash even for unknown emails to keep timing similar.
    const hash = user?.passwordHash ?? '$2b$10$ueCoiVWJhd.nVG7ReHewvetcTRlnM3R.4T1B3pKRLN1XJqRdFVl/6'
    const matches = await bcrypt.compare(dto.password, hash)
    if (!user?.passwordHash || !matches) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR)
    }

    return this.issueSession(user)
  }

  /**
   * Finds or creates the account for a verified provider identity. A local
   * account with the same verified email is linked rather than duplicated.
   */
  async loginWithOAuth(profile: OAuthProfile): Promise<{ token: string; user: PublicUser }> {
    const identity = await this.users.findOne({
      where: { oauthProvider: profile.provider, oauthSubject: profile.subject },
    })
    if (identity) {
      const changed =
        (profile.name && profile.name !== identity.name) ||
        (!identity.avatarUrl && Boolean(profile.avatarUrl))
      if (changed) {
        identity.name = profile.name || identity.name
        identity.avatarUrl = identity.avatarUrl ?? profile.avatarUrl
        await this.users.save(identity)
      }
      return this.issueSession(identity)
    }

    const byEmail = await this.users.findOne({ where: { email: profile.email } })
    if (byEmail) {
      if (
        byEmail.oauthSubject &&
        byEmail.oauthProvider !== 'local' &&
        byEmail.oauthProvider !== profile.provider
      ) {
        throw new ConflictException(
          'This email is already linked to a different sign-in method.',
        )
      }
      byEmail.oauthProvider = profile.provider
      byEmail.oauthSubject = profile.subject
      byEmail.avatarUrl = byEmail.avatarUrl ?? profile.avatarUrl
      try {
        await this.users.save(byEmail)
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new ConflictException('This sign-in method is already linked to another account.')
        }
        throw error
      }
      return this.issueSession(byEmail)
    }

    const created = this.users.create({
      email: profile.email,
      name: profile.name || profile.email.split('@')[0],
      passwordHash: null,
      avatarUrl: profile.avatarUrl,
      oauthProvider: profile.provider,
      oauthSubject: profile.subject,
    })

    try {
      await this.users.save(created)
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await this.users.findOne({
          where: { oauthProvider: profile.provider, oauthSubject: profile.subject },
        })
        if (raced) return this.issueSession(raced)
        throw new ConflictException('An account with this email already exists.')
      }
      throw error
    }

    return this.issueSession(created)
  }

  async userFromToken(token: string): Promise<PublicUser | null> {
    try {
      const payload = await this.jwt.verifyAsync<Partial<SessionPayload>>(token, {
        secret: this.config.authSecret,
      })
      if (!payload.sub) return null
      const user = await this.users.findOne({ where: { id: payload.sub } })
      return user ? toPublicUser(user) : null
    } catch {
      return null
    }
  }

  providers(): { google: boolean; github: boolean } {
    return { google: Boolean(this.config.google), github: Boolean(this.config.github) }
  }

  private async issueSession(user: User): Promise<{ token: string; user: PublicUser }> {
    const payload: SessionPayload = { sub: user.id, email: user.email, name: user.name }
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.authSecret,
      expiresIn: SESSION_TTL_SECONDS,
    })
    return { token, user: toPublicUser(user) }
  }
}
