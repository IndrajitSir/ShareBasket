import { ArrowRight, ShieldCheck, UsersRound } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { MemberRoleControls } from '@/components/member-role-controls'
import { ButtonLink, Container } from '@/components/ui'
import { getCurrentUser } from '@/lib/auth'
import { formatClosingDate } from '@/lib/format'
import { fetchGroupRoster } from '@/lib/groups'
import type { SocietyRole } from '@/lib/recommendation-types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Group roster',
  description: 'Members of your society group, and the steward who can manage them.',
}

function RoleBadge({ role }: { role: SocietyRole }) {
  const steward = role === 'STEWARD'
  return (
    <span
      className={
        steward
          ? 'inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] text-accent'
          : 'inline-flex items-center rounded-full border border-line-strong px-2.5 py-1 text-[11.5px] text-muted'
      }
    >
      {steward && <ShieldCheck className="size-3" aria-hidden />}
      {steward ? 'Steward' : 'Member'}
    </span>
  )
}

export default async function GroupRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await fetchGroupRoster(id)

  if (!result.ok && result.status === 404) notFound()

  if (!result.ok) {
    const signIn = result.status === 401
    return (
      <Container className="py-20">
        <p className="text-[14px] text-muted">Group</p>
        <h1 className="font-display mt-2 max-w-2xl text-[40px] leading-[1.02]">
          {signIn ? 'Sign in to see your group' : result.message}
        </h1>
        <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">
          {signIn
            ? 'Membership is tied to your account, so the roster is only shown to signed-in members.'
            : 'Membership is scoped to one society. Join this group to see who else is in it.'}
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <ButtonLink href={signIn ? `/login?next=/groups/${id}` : '/for-you'}>
            {signIn ? 'Sign in' : 'Find a group'}
            <ArrowRight />
          </ButtonLink>
          {!signIn && (
            <ButtonLink href={`/login?next=/groups/${id}`} variant="secondary">
              Use another account
            </ButtonLink>
          )}
        </div>
      </Container>
    )
  }

  const { roster } = result
  const viewer = await getCurrentUser()
  const isSteward = roster.viewerRole === 'STEWARD'

  return (
    <Container className="pb-24 pt-10 sm:pt-16">
      <p className="inline-flex items-center gap-2 text-[13px] text-muted">
        <UsersRound className="size-3.5" aria-hidden />
        {roster.society.location}
      </p>
      <h1 className="font-display mt-3 max-w-3xl text-balance text-[44px] leading-[0.98] sm:text-[56px]">
        {roster.society.name}
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted">
        {roster.society.memberCount} {roster.society.memberCount === 1 ? 'member' : 'members'} · you
        are a {isSteward ? 'steward' : 'member'} here.
        {isSteward
          ? ' Stewards can hand the role to another member of this group.'
          : ' Stewards can manage this roster.'}
      </p>
      <p className="mt-2 max-w-2xl text-[12.5px] leading-relaxed text-faint">
        A role only applies to this society. Being a steward elsewhere grants nothing here, and no
        email addresses are shown.
      </p>

      <ul className="mt-10 divide-y divide-line border-y border-line">
        {roster.members.map((member) => {
          const isViewer = viewer?.id === member.userId
          return (
            <li key={member.userId} className="flex flex-wrap items-center justify-between gap-4 py-4">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-[15px]">
                  <span className="truncate">{member.name}</span>
                  {isViewer && <span className="text-[12px] text-faint">you</span>}
                  <RoleBadge role={member.role} />
                </p>
                <p className="mt-0.5 text-[12.5px] text-muted">
                  Joined {formatClosingDate(member.joinedAt, 'long')}
                </p>
              </div>
              {isSteward && !isViewer && (
                <MemberRoleControls
                  societyId={roster.societyId}
                  userId={member.userId}
                  role={member.role}
                  name={member.name}
                />
              )}
            </li>
          )
        })}
      </ul>

      <p className="mt-6 text-[12.5px] leading-relaxed text-muted">
        Cannot change your own role, and a group always keeps at least one steward.
      </p>
    </Container>
  )
}
