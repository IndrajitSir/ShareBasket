import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common'

import { CurrentUser } from '../auth/current-user.decorator'
import { SessionAuthGuard } from '../auth/session-auth.guard'
import type { PublicUser } from '../auth/auth.types'
import { MembershipsService } from './memberships.service'

@Controller('me')
@UseGuards(SessionAuthGuard)
export class MembershipsController {
  constructor(private readonly memberships: MembershipsService) {}

  @Get('groups')
  async list(@CurrentUser() user: PublicUser) {
    return { groups: await this.memberships.listForUser(user.id) }
  }

  @Post('groups/:societyId')
  @HttpCode(201)
  async join(
    @CurrentUser() user: PublicUser,
    @Param('societyId', new ParseUUIDPipe()) societyId: string,
  ) {
    return { group: await this.memberships.join(user.id, societyId) }
  }

  @Delete('groups/:societyId')
  @HttpCode(204)
  async leave(
    @CurrentUser() user: PublicUser,
    @Param('societyId', new ParseUUIDPipe()) societyId: string,
  ): Promise<void> {
    await this.memberships.leave(user.id, societyId)
  }
}
