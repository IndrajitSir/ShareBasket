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
  UseGuards,
} from '@nestjs/common'
import type { Request, Response } from 'express'

import type { PublicUser } from '../auth/auth.types'
import { CurrentUser } from '../auth/current-user.decorator'
import { LoginDto } from '../auth/dto/login.dto'
import {
  AUTH_CONFIG,
  SESSION_COOKIE,
  sessionCookieOptions,
} from '../auth/auth.constants'
import { SessionAuthGuard } from '../auth/session-auth.guard'
import type { AppConfig } from '../config/app-config'
import { SecurityService, TooManyAttemptsException } from './security.service'
import { ConfirmMfaDto, DisableMfaDto, ResetDto, ResetRequestDto, VerifyMfaDto } from './dto/security.dto'

type ClientRequest = Request & { ip?: string; ips?: string[] }

function clientIp(request: ClientRequest): string {
  return request.ip || request.ips?.[0] || 'unknown'
}

/** Auth endpoints beyond the basic session: MFA login, reset and verification. */
@Controller('auth')
export class SecurityController {
  private readonly logger = new Logger(SecurityController.name)

  constructor(
    private readonly security: SecurityService,
    @Inject(AUTH_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() request: ClientRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.security.login(dto, clientIp(request))
    if (result.mfa) return { mfaRequired: true, challenge: result.mfa.challenge }
    if (result.token) {
      response.cookie(SESSION_COOKIE, result.token, sessionCookieOptions(this.config.sessionCookieSecure))
    }
    return { user: result.user }
  }

  @Post('login/mfa')
  @HttpCode(200)
  async verifyMfa(@Body() dto: VerifyMfaDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.security.verifyMfa(dto.challenge, dto.code)
    if (result.token) {
      response.cookie(SESSION_COOKIE, result.token, sessionCookieOptions(this.config.sessionCookieSecure))
    }
    return { user: result.user }
  }

  @Post('password/reset-request')
  @HttpCode(202)
  async requestReset(
    @Body() dto: ResetRequestDto,
    @Req() request: ClientRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      await this.security.requestPasswordReset(dto.email, clientIp(request))
      return { status: 'accepted' }
    } catch (caught) {
      if (caught instanceof TooManyAttemptsException) {
        response.setHeader('retry-after', String(caught.retryAfterSeconds))
      }
      throw caught
    }
  }

  @Post('password/reset')
  @HttpCode(204)
  async resetPassword(@Body() dto: ResetDto): Promise<void> {
    await this.security.resetPassword(dto.token, dto.password)
  }

  @Get('email/status')
  @UseGuards(SessionAuthGuard)
  emailStatus(@CurrentUser() user: PublicUser) {
    return this.security.emailStatus(user)
  }

  @Post('email/resend-verification')
  @HttpCode(202)
  @UseGuards(SessionAuthGuard)
  async resendVerification(@CurrentUser() user: PublicUser) {
    await this.security.resendVerification(user)
    return { status: 'sent' }
  }

  /** Browser-facing link target: verifies then redirects to the web app. */
  @Get('email/verify')
  async verifyEmail(@Query('token') token: string | undefined, @Res() response: Response): Promise<void> {
    try {
      await this.security.verifyEmail(token)
      response.redirect(`${this.config.publicWebUrl}/verify-email?status=verified`)
    } catch (caught) {
      this.logger.warn(`Email verification failed: ${caught instanceof Error ? caught.message : 'unknown'}`)
      response.redirect(`${this.config.publicWebUrl}/verify-email?status=invalid`)
    }
  }

  @Get('mfa/status')
  @UseGuards(SessionAuthGuard)
  mfaStatus(@CurrentUser() user: PublicUser) {
    return this.security.mfaStatus(user)
  }

  @Post('mfa/start')
  @HttpCode(200)
  @UseGuards(SessionAuthGuard)
  startMfa(@CurrentUser() user: PublicUser) {
    return this.security.startMfaEnrollment(user)
  }

  @Post('mfa/confirm')
  @HttpCode(204)
  @UseGuards(SessionAuthGuard)
  async confirmMfa(@CurrentUser() user: PublicUser, @Body() dto: ConfirmMfaDto): Promise<void> {
    await this.security.confirmMfaEnrollment(user, dto.code)
  }

  @Post('mfa/disable')
  @HttpCode(204)
  @UseGuards(SessionAuthGuard)
  async disableMfa(@CurrentUser() user: PublicUser, @Body() dto: DisableMfaDto): Promise<void> {
    await this.security.disableMfa(user, dto.code)
  }
}
