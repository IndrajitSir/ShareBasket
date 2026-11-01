import { Equals, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator'

import { TENANCY_TYPES, type TenancyType } from '../membership-verification'

/**
 * Deliberately minimal: the society already carries the street location, so a
 * member supplies only the block/unit and how they occupy it. No document,
 * identity number or free-text address is accepted.
 */
const LABEL = /^[A-Za-z0-9][A-Za-z0-9 ./-]*$/

export class SubmitResidenceClaimDto {
  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(LABEL, {
    message: 'Block may contain letters, numbers, spaces, dots, slashes or hyphens.',
  })
  block?: string

  @IsString()
  @MaxLength(20)
  @Matches(LABEL, {
    message: 'Unit may contain letters, numbers, spaces, dots, slashes or hyphens.',
  })
  unit!: string

  @IsIn(TENANCY_TYPES)
  tenancy!: TenancyType

  @Equals(true, { message: 'Confirm that these residence details are yours.' })
  attested!: boolean
}
