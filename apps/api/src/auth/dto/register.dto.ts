import { Transform } from 'class-transformer'
import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator'

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value)

export class RegisterDto {
  @Transform(({ value }) => {
    const email = trim({ value })
    return typeof email === 'string' ? email.toLowerCase() : email
  })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email: string

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters.' })
  @MaxLength(72, { message: 'Password cannot exceed 72 characters.' })
  password: string

  @Transform(trim)
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters.' })
  @MaxLength(80)
  name: string
}
