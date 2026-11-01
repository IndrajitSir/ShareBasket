import { LoginRateLimiter } from '../src/security/login-rate-limiter'

describe('LoginRateLimiter', () => {
  it('allows requests under the limit', () => {
    const limiter = new LoginRateLimiter(5, 60_000)
    for (let i = 0; i < 5; i++) {
      expect(limiter.allow('user@test.com', '127.0.0.1')).toBe(true)
      limiter.fail('user@test.com', '127.0.0.1')
    }
  })

  it('blocks after max attempts', () => {
    const limiter = new LoginRateLimiter(3, 60_000)
    for (let i = 0; i < 3; i++) {
      limiter.fail('user@test.com', '127.0.0.1')
    }
    expect(limiter.allow('user@test.com', '127.0.0.1')).toBe(false)
  })

  it('resets after a successful login', () => {
    const limiter = new LoginRateLimiter(3, 60_000)
    for (let i = 0; i < 3; i++) {
      limiter.fail('user@test.com', '127.0.0.1')
    }
    limiter.reset('user@test.com', '127.0.0.1')
    expect(limiter.allow('user@test.com', '127.0.0.1')).toBe(true)
  })

  it('tracks different IPs independently', () => {
    const limiter = new LoginRateLimiter(2, 60_000)
    limiter.fail('user@test.com', '1.1.1.1')
    limiter.fail('user@test.com', '1.1.1.1')
    expect(limiter.allow('user@test.com', '1.1.1.1')).toBe(false)
    expect(limiter.allow('user@test.com', '2.2.2.2')).toBe(true)
  })

  it('tracks different emails independently', () => {
    const limiter = new LoginRateLimiter(2, 60_000)
    limiter.fail('a@test.com', '127.0.0.1')
    limiter.fail('a@test.com', '127.0.0.1')
    expect(limiter.allow('a@test.com', '127.0.0.1')).toBe(false)
    expect(limiter.allow('b@test.com', '127.0.0.1')).toBe(true)
  })

  it('returns remaining milliseconds', () => {
    const limiter = new LoginRateLimiter(2, 60_000)
    limiter.fail('user@test.com', '127.0.0.1')
    const remaining = limiter.remainingMs('user@test.com', '127.0.0.1')
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(60_000)
  })

  it('returns 0 remaining for unknown keys', () => {
    const limiter = new LoginRateLimiter(2, 60_000)
    expect(limiter.remainingMs('nobody@test.com', '127.0.0.1')).toBe(0)
  })

  it('disables rate limiting when maxAttempts is 0', () => {
    const limiter = new LoginRateLimiter(0, 60_000)
    expect(limiter.allow('user@test.com', '127.0.0.1')).toBe(true)
    limiter.fail('user@test.com', '127.0.0.1')
    expect(limiter.allow('user@test.com', '127.0.0.1')).toBe(true)
  })

  it('expires after the window', () => {
    const savedNow = Date.now
    let simulatedTime = 1_000_000
    Date.now = () => simulatedTime

    const limiter = new LoginRateLimiter(2, 60_000)
    limiter.fail('user@test.com', '127.0.0.1')
    limiter.fail('user@test.com', '127.0.0.1')
    expect(limiter.allow('user@test.com', '127.0.0.1')).toBe(false)

    // Advance time past the window (60s) and past the sweep interval (60s)
    simulatedTime = 1_000_000 + 130_000
    expect(limiter.allow('user@test.com', '127.0.0.1')).toBe(true)
    Date.now = savedNow
  })

  it('normalizes email case', () => {
    const limiter = new LoginRateLimiter(2, 60_000)
    limiter.fail('User@Test.COM', '127.0.0.1')
    limiter.fail('user@test.com', '127.0.0.1')
    expect(limiter.allow('USER@TEST.COM', '127.0.0.1')).toBe(false)
  })
})
