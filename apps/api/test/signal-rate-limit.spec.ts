import { SlidingWindowRateLimiter } from '../src/recommendations/signal-rate-limit'

const WINDOW = 60_000
const START = 1_000_000

describe('SlidingWindowRateLimiter', () => {
  it('allows the limit then denies until the window slides', () => {
    const limiter = new SlidingWindowRateLimiter(2, WINDOW)

    expect(limiter.take('user-a', START)).toBe(true)
    expect(limiter.take('user-a', START + 10)).toBe(true)
    expect(limiter.take('user-a', START + 20)).toBe(false)

    // Still inside the window.
    expect(limiter.take('user-a', START + WINDOW - 1)).toBe(false)

    // The first two attempts have expired; one slot is available again.
    expect(limiter.take('user-a', START + WINDOW + 1)).toBe(true)
  })

  it('tracks members independently', () => {
    const limiter = new SlidingWindowRateLimiter(1, WINDOW)

    expect(limiter.take('user-a', START)).toBe(true)
    expect(limiter.take('user-a', START)).toBe(false)
    expect(limiter.take('user-b', START)).toBe(true)
  })

  it('disables limiting at 0 and rejects invalid configuration', () => {
    const unlimited = new SlidingWindowRateLimiter(0)
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(unlimited.take('user-a', START)).toBe(true)
    }

    expect(() => new SlidingWindowRateLimiter(-1)).toThrow('non-negative integer')
    expect(() => new SlidingWindowRateLimiter(5, 0)).toThrow('positive number of milliseconds')
  })
})
