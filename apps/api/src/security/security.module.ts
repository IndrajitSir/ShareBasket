import { Module } from '@nestjs/common'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'

import { AUTH_CONFIG } from '../auth/auth.constants'
import { AuthService } from '../auth/auth.service'
import { loadConfig } from '../config/app-config'
import { User } from '../database/entities/user.entity'
import { ConsoleMailer } from './console-mailer'
import { PurposeTokenService } from './purpose-token.service'
import { SecurityController } from './security.controller'
import { SecurityService } from './security.service'

@Module({
  imports: [TypeOrmModule.forFeature([User]), JwtModule.register({})],
  controllers: [SecurityController],
  providers: [
    AuthService,
    SecurityService,
    PurposeTokenService,
    ConsoleMailer,
    { provide: AUTH_CONFIG, useFactory: () => loadConfig() },
  ],
  exports: [SecurityService, ConsoleMailer],
})
export class SecurityModule {}
