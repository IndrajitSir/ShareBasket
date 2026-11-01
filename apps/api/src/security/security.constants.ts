export const VERIFY_PURPOSE = 'email_verify'
export const RESET_PURPOSE = 'password_reset'

export const VERIFY_TTL_SECONDS = 24 * 60 * 60
export const RESET_TTL_SECONDS = 30 * 60

/**
 * One-time tokens are stateless JWTs distinct from the session token: they
 * carry a purpose claim so a verify/reset token can never be accepted as a
 * session and vice versa. Hashes stored alongside consume() are the database
 * roundtrip that makes them single use even against parallel requests.
 */
export interface PurposeTokenPayload {
  sub: string
  email: string
  purpose: string
}
