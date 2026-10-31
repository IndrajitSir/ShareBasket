import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common'
import type { Request } from 'express'

import type { PublicUser } from '../auth/auth.types'
import { AuthService } from '../auth/auth.service'
import { resolveRequestUser } from '../auth/request-user'
import { SessionAuthGuard } from '../auth/session-auth.guard'
import { NearbyGroupsDto } from './dto/nearby.dto'
import { RecommendationsService } from './recommendations.service'

type SessionRequest = Request & { user?: PublicUser }

@Controller('recommendations')
export class RecommendationsController {
  constructor(
    private readonly recommendations: RecommendationsService,
    private readonly auth: AuthService,
  ) {}

  /** Personalised when a session cookie is present; otherwise public trending. */
  @Get('for-you')
  forYou(@Req() request: SessionRequest) {
    return resolveRequestUser(this.auth, request).then((user) => this.recommendations.forUser(user))
  }

  /** Coordinates go in the body so they never appear in URLs or access logs. */
  @Post('nearby')
  @HttpCode(200)
  @UseGuards(SessionAuthGuard)
  nearby(@Req() request: SessionRequest, @Body() body: NearbyGroupsDto) {
    return this.recommendations.nearby(request.user!.id, body)
  }
}
