export const SIGNAL_RATE_LIMITER = Symbol('SIGNAL_RATE_LIMITER')

/**
 * Per-user sliding window used to bound implicit quote signals. It is
 * deliberately in-process: the API is stateless apart from this short-lived
 * counter, and a pilot runs one instance. Behind several replicas the limit is
 * per replica, which still caps a single client's write amplification.
 *
 * A limit of 0 disables limiting (useful for local tests and demos).
 */
export class SlidingWindowRateLimiter {
  private readonly hits = new Map<string, number[]>()

  constructor(
    private readonly limit: number,
    private readonly windowMs = 60_000,
  ) {
    if (!Number.isInteger(limit) || limit < 0) {
      throw new Error('A rate limit must be a non-negative integer.')
    }
    if (!Number.isFinite(windowMs) || windowMs <= 0) {
      throw new Error('A rate-limit window must be a positive number of milliseconds.')
    }
  }

  /** Returns true when the call is allowed and records it. */
  take(key: string, now = Date.now()): boolean {
    if (this.limit === 0) return true

    const cutoff = now - this.windowMs
    const recent = (this.hits.get(key) ?? []).filter((at) => at > cutoff)
    if (recent.length >= this.limit) {
      // Keep the pruned list so denied attempts do not grow memory.
      this.hits.set(key, recent)
      return false
    }

    recent.push(now)
    this.hits.set(key, recent)
    if (this.hits.size > 10_000) this.prune(cutoff)
    return true
  }

  private prune(cutoff: number): void {
    for (const [key, timestamps] of this.hits) {
      const recent = timestamps.filter((at) => at > cutoff)
      if (recent.length === 0) this.hits.delete(key)
      else this.hits.set(key, recent)
    }
  }
}
