import { Transform } from 'class-transformer'
import { IsEmail, IsString, MaxLength } from 'class-validator'

export class LoginDto {
  @Transform(({ value }) => {
    const email = typeof value === 'string' ? value.trim().toLowerCase() : value
    return email
  })
  @IsEmail({}, { message: 'Enter a valid email address.' })
  @MaxLength(254)
  email: string

  @IsString()
  @MaxLength(72)
  password: string
}
