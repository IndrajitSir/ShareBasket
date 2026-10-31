import { IsIn } from 'class-validator'

import { SOCIETY_ROLES, type SocietyRole } from '../society-role'

export class UpdateMemberRoleDto {
  @IsIn(SOCIETY_ROLES)
  role: SocietyRole
}
