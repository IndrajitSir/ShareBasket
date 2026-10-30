import { IsInt, Max, Min } from 'class-validator'

import { MAX_UNITS_PER_QUOTE } from '../campaign-pricing'

export class QuoteDto {
  @IsInt({ message: 'quantity must be a whole number.' })
  @Min(1, { message: 'Quantity must be a whole number of at least 1.' })
  @Max(MAX_UNITS_PER_QUOTE, {
    message: `Quantity cannot exceed ${MAX_UNITS_PER_QUOTE} units per household.`,
  })
  quantity: number
}
