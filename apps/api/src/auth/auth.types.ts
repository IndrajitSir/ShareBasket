import type { OAuthProvider } from '../database/entities/user.entity'

export type ExternalProvider = Exclude<OAuthProvider, 'local'>

export interface PublicUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  provider: OAuthProvider
  createdAt: string
}

export interface OAuthProfile {
  provider: ExternalProvider
  subject: string
  email: string
  name: string
  avatarUrl: string | null
  emailVerified: true
}
