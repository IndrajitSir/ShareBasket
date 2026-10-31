import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AUTH_CONFIG } from './auth.constants'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { OAuthService } from './oauth.service'
import { SessionAuthGuard } from './session-auth.guard'
import { loadConfig } from '../config/app-config'
import { User } from '../database/entities/user.entity'

@Module({
  imports: [TypeOrmModule.forFeature([User]), JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    OAuthService,
    SessionAuthGuard,
    { provide: AUTH_CONFIG, useFactory: () => loadConfig() },
  ],
  exports: [AuthService, SessionAuthGuard],
})
export class AuthModule {}
