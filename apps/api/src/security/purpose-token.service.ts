import { Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { createHash } from 'node:crypto'

import { AUTH_CONFIG } from '../auth/auth.constants'
import type { AppConfig } from '../config/app-config'
import { RESET_PURPOSE, RESET_TTL_SECONDS, VERIFY_PURPOSE, VERIFY_TTL_SECONDS, type PurposeTokenPayload } from './security.constants'

export function tokenFingerprint(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/**
 * Signs and verifies purpose-scoped, single-use JWTs for email verification
 * and password reset. Single use is enforced by storing the fingerprint of
 * the last issued token on the user row; presenting an older token fails.
 */
export class PurposeTokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AppConfig,
  ) {}

  signVerifyToken(userId: string, email: string): Promise<string> {
    return this.sign(userId, email, VERIFY_PURPOSE, VERIFY_TTL_SECONDS)
  }

  signResetToken(userId: string, email: string): Promise<string> {
    return this.sign(userId, email, RESET_PURPOSE, RESET_TTL_SECONDS)
  }

  /**
   * Returns the payload only when the purpose matches, the signature is
   * valid, and the fingerprint matches the one recorded on the account.
   */
  async consume(
    token: string,
    purpose: string,
    expectedFingerprint: string | null,
  ): Promise<PurposeTokenPayload | null> {
    try {
      const payload = await this.jwt.verifyAsync<PurposeTokenPayload>(token, {
        secret: `${this.config.authSecret}:${purpose}`,
      })
      if (payload.purpose !== purpose) return null
      if (expectedFingerprint && tokenFingerprint(token) !== expectedFingerprint) return null
      return payload
    } catch {
      return null
    }
  }

  private sign(userId: string, email: string, purpose: string, ttl: number): Promise<string> {
    const payload: PurposeTokenPayload = { sub: userId, email, purpose }
    return this.jwt.signAsync(payload, {
      secret: `${this.config.authSecret}:${purpose}`,
      expiresIn: ttl,
    })
  }
}
