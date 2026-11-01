import { Transform } from 'class-transformer'
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class VerifyMfaDto {
  @IsString()
  @MaxLength(1024)
  challenge: string

  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from your authenticator.' })
  code: string
}

export class ResetRequestDto {
  @Transform(({ value }) => {
    const email = trim({ value })
    return typeof email === 'string' ? email.toLowerCase() : email
  })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email: string
}

export class ResetDto {
  @Transform(trim)
  @IsString()
  @MaxLength(2048)
  token: string

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(72, { message: 'Password cannot exceed 72 characters.' })
  password: string
}

export class ConfirmMfaDto {
  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from your authenticator.' })
  code: string
}

export class DisableMfaDto {
  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from your authenticator.' })
  code: string
}

export class MfaCodeDto {
  @Transform(trim)
  @Matches(/^\d{6}$/, { message: 'Enter the 6-digit code from your authenticator.' })
  code: string
}
