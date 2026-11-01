import { Injectable } from '@nestjs/common'

interface Bucket {
  count: number
  expiresAt: number
}

/**
 * Fixed-window counter of failed logins keyed by email plus client IP. Counts
 * live only in this process: restarting the API clears them, which is an
 * accepted trade-off for a preview deployment — the brute-force cost stays
 * high without any new infrastructure.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly buckets = new Map<string, Bucket>()
  private lastSweep = 0

  constructor(
    private readonly maxAttempts: number,
    private readonly windowMs: number,
  ) {}

  /** Returns false when the key has exhausted its failure budget. */
  allow(email: string, ip: string): boolean {
    if (this.maxAttempts <= 0) return true
    this.sweep()
    const bucket = this.buckets.get(this.key(email, ip))
    return !bucket || bucket.count < this.maxAttempts
  }

  /** Records one failed attempt. */
  fail(email: string, ip: string): void {
    if (this.maxAttempts <= 0) return
    this.sweep()
    const key = this.key(email, ip)
    const bucket = this.buckets.get(key)
    if (bucket && bucket.expiresAt > Date.now()) {
      bucket.count += 1
      return
    }
    this.buckets.set(key, { count: 1, expiresAt: Date.now() + this.windowMs })
  }

  /** Clears a key after a successful login so honest users never lock out. */
  reset(email: string, ip: string): void {
    this.buckets.delete(this.key(email, ip))
  }

  remainingMs(email: string, ip: string): number {
    const bucket = this.buckets.get(this.key(email, ip))
    if (!bucket) return 0
    return Math.max(0, bucket.expiresAt - Date.now())
  }

  private key(email: string, ip: string): string {
    return `${email.toLowerCase()}|${ip}`
  }

  private sweep(): void {
    const now = Date.now()
    if (now - this.lastSweep < 60_000) return
    this.lastSweep = now
    for (const [key, bucket] of this.buckets) {
      if (bucket.expiresAt <= now) this.buckets.delete(key)
    }
  }
}
