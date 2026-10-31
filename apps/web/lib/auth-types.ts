export interface AuthUser {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  provider: 'local' | 'google' | 'github'
  createdAt: string
}

export interface AuthProviders {
  google: boolean
  github: boolean
}
