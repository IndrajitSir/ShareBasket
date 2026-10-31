import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

export class ListCampaignsQuery {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-z0-9-]*$/, { message: 'category must be a lowercase slug.' })
  category?: string

  @IsOptional()
  @IsString()
  @MaxLength(120)
  society?: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string

  @IsOptional()
  @IsIn(['closing', 'progress'])
  sort?: 'closing' | 'progress'
}
