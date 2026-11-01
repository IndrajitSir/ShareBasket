import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Logger,
  Post,
  Query,
  Req,
  Res,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { randomBytes } from 'node:crypto'

import {
  AUTH_CONFIG,
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  clearedCookieOptions,
  oauthStateCookieOptions,
  sessionCookieOptions,
} from './auth.constants'
import { AuthService } from './auth.service'
import type { ExternalProvider, PublicUser } from './auth.types'
import { CurrentUser } from './current-user.decorator'
import { RegisterDto } from './dto/register.dto'
import { OAuthExchangeError, OAuthService } from './oauth.service'
import { SessionAuthGuard } from './session-auth.guard'
import { SecurityService } from '../security/security.service'
import type { AppConfig } from '../config/app-config'

type OAuthRequest = Request & { cookies?: Record<string, string> }

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name)

  constructor(
    private readonly auth: AuthService,
    private readonly oauth: OAuthService,
    private readonly security: SecurityService,
    @Inject(AUTH_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) response: Response) {
    const session = await this.auth.register(dto)
    response.cookie(SESSION_COOKIE, session.token, sessionCookieOptions(this.config.sessionCookieSecure))
    // Local accounts start unverified; the link goes out immediately. The
    // service returns the public shape, so only the id is needed.
    await this.security.sendVerificationByUserId(session.user.id)
    return { user: session.user }
  }

  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) response: Response): void {
    response.clearCookie(SESSION_COOKIE, clearedCookieOptions(this.config.sessionCookieSecure))
  }

  @Get('me')
  @UseGuards(SessionAuthGuard)
  me(@CurrentUser() user: PublicUser) {
    return { user }
  }

  @Get('providers')
  providers() {
    return this.auth.providers()
  }

  @Get('google')
  google(@Res() response: Response): void {
    this.startOAuth('google', response)
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: OAuthRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.finishOAuth('google', code, state, error, request, response)
  }

  @Get('github')
  github(@Res() response: Response): void {
    this.startOAuth('github', response)
  }

  @Get('github/callback')
  async githubCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Req() request: OAuthRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.finishOAuth('github', code, state, error, request, response)
  }

  private startOAuth(provider: ExternalProvider, response: Response): void {
    if (!this.oauth.isConfigured(provider)) {
      const label = provider === 'google' ? 'Google' : 'GitHub'
      throw new ServiceUnavailableException(`${label} sign-in is not configured.`)
    }

    const state = randomBytes(32).toString('base64url')
    response.cookie(
      OAUTH_STATE_COOKIE,
      `${provider}:${state}`,
      oauthStateCookieOptions(this.config.sessionCookieSecure),
    )
    response.redirect(this.oauth.authorizeUrl(provider, state))
  }

  private async finishOAuth(
    provider: ExternalProvider,
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
    request: OAuthRequest,
    response: Response,
  ): Promise<void> {
    const cookie = request.cookies?.[OAUTH_STATE_COOKIE]
    response.clearCookie(OAUTH_STATE_COOKIE, clearedCookieOptions(this.config.sessionCookieSecure))

    if (error || !code) {
      this.redirectFailure(response, 'oauth_cancelled')
      return
    }
    if (!state || !cookie || cookie !== `${provider}:${state}`) {
      this.logger.warn(`Rejected ${provider} OAuth callback with a missing or mismatched state.`)
      this.redirectFailure(response, 'oauth_state')
      return
    }

    try {
      const profile = await this.oauth.exchange(provider, code)
      const session = await this.auth.loginWithOAuth(profile)
      response.cookie(
        SESSION_COOKIE,
        session.token,
        sessionCookieOptions(this.config.sessionCookieSecure),
      )
      response.redirect(`${this.config.publicWebUrl}/account?welcome=1`)
    } catch (caught) {
      const message =
        caught instanceof OAuthExchangeError ? caught.message : 'Unexpected OAuth exchange error.'
      this.logger.warn(`${provider} OAuth sign-in failed: ${message}`)
      this.redirectFailure(response, 'oauth_failed')
    }
  }

  private redirectFailure(response: Response, reason: string): void {
    response.redirect(`${this.config.publicWebUrl}/login?error=${encodeURIComponent(reason)}`)
  }
}
