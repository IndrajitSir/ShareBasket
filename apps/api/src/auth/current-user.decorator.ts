import { createParamDecorator, type ExecutionContext } from '@nestjs/common'

import type { PublicUser } from './auth.types'

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PublicUser =>
    context.switchToHttp().getRequest<{ user: PublicUser }>().user,
)
