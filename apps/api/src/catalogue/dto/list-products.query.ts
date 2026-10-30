import { Type } from 'class-transformer'
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator'

export class ListProductsQuery {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^[a-z0-9-]*$/, { message: 'category must be a lowercase slug.' })
  category?: string

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(60)
  limit?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPricePaise?: number

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPricePaise?: number

  @IsOptional()
  @IsIn(['featured', 'new', 'price-asc', 'price-desc'])
  sort?: 'featured' | 'new' | 'price-asc' | 'price-desc'
}
