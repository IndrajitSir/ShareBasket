import { createHmac } from 'node:crypto'
import { generateTotpSecret, verifyTotp, totpUri, toKeyUriHash } from '../src/security/totp'

// Mirror the module's internal hotp so tests generate codes the module accepts.
function hotp(secretBase32: string, counter: number): string {
  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  const key: number[] = []
  for (const char of secretBase32.replace(/=+$/, '')) {
    const index = ALPHABET.indexOf(char.toUpperCase())
    if (index === -1) throw new Error('bad secret')
    value = (value << 5) | index
    bits += 5
    while (bits >= 8) {
      key.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  while (key.length < 20) key.push(0)
  const buffer = Buffer.alloc(8)
  buffer.writeUInt32BE(Math.floor(counter / 2 ** 32), 0)
  buffer.writeUInt32BE(counter % 2 ** 32, 4)
  const digest = createHmac('sha1', Buffer.from(key)).update(buffer).digest()
  const offset = digest[digest.length - 1] & 0x0f
  const code =
    (((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3]) %
    1_000_000
  return code.toString().padStart(6, '0')
}

describe('TOTP', () => {
  describe('generateTotpSecret', () => {
    it('returns a base32 string', () => {
      const secret = generateTotpSecret()
      expect(secret).toMatch(/^[A-Z2-7]+$/)
      expect(secret.length).toBeGreaterThanOrEqual(16)
    })

    it('generates unique secrets', () => {
      const a = generateTotpSecret()
      const b = generateTotpSecret()
      expect(a).not.toBe(b)
    })
  })

  describe('verifyTotp', () => {
    it('accepts a valid code for the current step', () => {
      const secret = generateTotpSecret()
      const savedNow = Date.now
      Date.now = () => 59_000 // step = 1
      try {
        const code = hotp(secret, 1)
        expect(verifyTotp(secret, code, null)).toBe(true)
      } finally {
        Date.now = savedNow
      }
    })

    it('rejects an invalid code', () => {
      const secret = generateTotpSecret()
      const savedNow = Date.now
      Date.now = () => 59_000
      try {
        expect(verifyTotp(secret, '000000', null)).toBe(false)
      } finally {
        Date.now = savedNow
      }
    })

    it('rejects non-6-digit input', () => {
      expect(verifyTotp('ANYSECRET', '12345', null)).toBe(false)
      expect(verifyTotp('ANYSECRET', '1234567', null)).toBe(false)
      expect(verifyTotp('ANYSECRET', 'abcdef', null)).toBe(false)
    })

    it('never accepts a code from a step before lastUsedAt', () => {
      const secret = generateTotpSecret()
      const savedNow = Date.now
      Date.now = () => 60_000 // step = 2
      try {
        const lastUsed = new Date(60_000) // step 2
        const code = hotp(secret, 2)
        expect(verifyTotp(secret, code, lastUsed)).toBe(false)
      } finally {
        Date.now = savedNow
      }
    })

    it('accepts a code from the current step when lastUsedAt is behind', () => {
      const secret = generateTotpSecret()
      const savedNow = Date.now
      Date.now = () => 60_000 // step = 2
      try {
        const lastUsed = new Date(0) // step 0
        const code = hotp(secret, 2)
        expect(verifyTotp(secret, code, lastUsed)).toBe(true)
      } finally {
        Date.now = savedNow
      }
    })

    it('tolerates whitespace in codes', () => {
      const secret = generateTotpSecret()
      const savedNow = Date.now
      Date.now = () => 59_000 // step = 1
      try {
        const code = hotp(secret, 1)
        const withSpaces = code.slice(0, 3) + ' ' + code.slice(3)
        expect(verifyTotp(secret, withSpaces, null)).toBe(true)
      } finally {
        Date.now = savedNow
      }
    })

    it('accepts one step of drift (previous step)', () => {
      const secret = generateTotpSecret()
      const savedNow = Date.now
      Date.now = () => 90_000 // step = 3
      try {
        const prevCode = hotp(secret, 2)
        expect(verifyTotp(secret, prevCode, null)).toBe(true)
      } finally {
        Date.now = savedNow
      }
    })

    it('accepts one step of drift (next step)', () => {
      const secret = generateTotpSecret()
      const savedNow = Date.now
      Date.now = () => 90_000 // step = 3
      try {
        const nextCode = hotp(secret, 4)
        expect(verifyTotp(secret, nextCode, null)).toBe(true)
      } finally {
        Date.now = savedNow
      }
    })
  })

  describe('totpUri', () => {
    it('produces a valid otpauth URI', () => {
      const uri = totpUri('JBSWY3DPEHPK3PXP', 'user@example.com', 'ShareBasket')
      expect(uri).toMatch(/^otpauth:\/\/totp\//)
      expect(uri).toContain('secret=JBSWY3DPEHPK3PXP')
      expect(uri).toContain('issuer=ShareBasket')
      expect(uri).toContain('user%40example.com')
    })
  })

  describe('toKeyUriHash', () => {
    it('produces a deterministic sha256 hex digest', () => {
      const uri = 'otpauth://totp/test'
      const hash = toKeyUriHash(uri)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
      expect(toKeyUriHash(uri)).toBe(hash)
    })
  })
})
