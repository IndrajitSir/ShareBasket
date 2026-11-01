import { createHash, createHmac, randomBytes } from 'node:crypto'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export function generateTotpSecret(): string {
  const bytes = randomBytes(20)
  let bits = 0
  let value = 0
  let output = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  return output
}

function hotp(secretBase32: string, counter: number): string {
  let bits = 0
  let value = 0
  const key: number[] = []
  for (const char of secretBase32.replace(/=+$/, '')) {
    const index = BASE32_ALPHABET.indexOf(char.toUpperCase())
    if (index === -1) throw new Error('Invalid base32 TOTP secret.')
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
    (((digest[offset] & 0x7f) << 24) |
      (digest[offset + 1] << 16) |
      (digest[offset + 2] << 8) |
      digest[offset + 3]) %
    1_000_000
  return code.toString().padStart(6, '0')
}

/**
 * Verifies a 6-digit TOTP code against the current 30-second step, allowing
 * one step of drift in either direction, without ever accepting the same step
 * twice (the caller records lastUsedAt).
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  lastUsedAt: Date | null,
): boolean {
  const normalized = code.replace(/\s+/g, '')
  if (!/^\d{6}$/.test(normalized)) return false

  const step = Math.floor(Date.now() / 1000 / 30)
  const lastUsedStep = lastUsedAt ? Math.floor(new Date(lastUsedAt).getTime() / 1000 / 30) : null

  for (const candidate of [step, step - 1, step + 1]) {
    if (lastUsedStep !== null && candidate <= lastUsedStep) continue
    if (hotp(secretBase32, candidate) === normalized) return true
  }
  return false
}

export function totpUri(secretBase32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: 'SHA1', digits: '6', period: '30' })
  return `otpauth://totp/${label}?${params.toString()}`
}

export function toKeyUriHash(uri: string): string {
  return createHash('sha256').update(uri).digest('hex')
}
