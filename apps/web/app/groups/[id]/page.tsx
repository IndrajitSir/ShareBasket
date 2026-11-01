import { ArrowRight, Hourglass, MapPin, ShieldCheck, UsersRound } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { ReactNode } from 'react'

import { AuditTimeline } from '@/components/audit-timeline'
import { CancelRequestButton } from '@/components/cancel-request-button'
import { JoinRequestControls } from '@/components/join-request-controls'
import { MemberRoleControls } from '@/components/member-role-controls'
import { ResidenceClaimForm } from '@/components/residence-claim-form'
import { ResidenceReviewControls } from '@/components/residence-review-controls'
import { ButtonLink, Container } from '@/components/ui'
import { VerificationStatusBadge } from '@/components/verification-status'
import { getCurrentUser } from '@/lib/auth'
import { formatClosingDate } from '@/lib/format'
import { fetchGroupMembership, fetchGroupRoster } from '@/lib/groups'
import type { GroupSummary, SocietyRole, TenancyType } from '@/lib/recommendation-types'

const TENANCY_LABEL: Record<TenancyType, string> = {
  OWNER: 'Owner',
  TENANT: 'Tenant',
  FAMILY: 'Family home',
}

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Group roster',
  description: 'Members of your society group, join requests, and who can manage them.',
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

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <div
      className={
        highlight && value > 0
          ? 'rounded-[16px] border border-accent/40 bg-accent-soft px-4 py-3'
          : 'rounded-[16px] border border-line bg-surface px-4 py-3'
      }
    >
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="mt-1 font-display text-[28px] leading-none tabular-nums">{value}</dd>
    </div>
  )
}

function MessageState({
  eyebrow,
  title,
  body,
  detail,
  actions,
}: {
  eyebrow: string
  title: string
  body: string
  detail?: string
  actions: ReactNode
}) {
  return (
    <Container className="py-20">
      <p className="text-[14px] text-muted">{eyebrow}</p>
      <h1 className="font-display mt-2 max-w-2xl text-balance text-[40px] leading-[1.02]">{title}</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-muted">{body}</p>
      {detail && <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-faint">{detail}</p>}
      <div className="mt-6 flex flex-wrap gap-2">{actions}</div>
    </Container>
  )
}

function PendingState({ group }: { group: GroupSummary }) {
  return (
    <Container className="pb-24 pt-10 sm:pt-16">
      <p className="inline-flex items-center gap-2 text-[13px] text-muted">
        <UsersRound className="size-3.5" aria-hidden />
        {group.location}
      </p>
      <h1 className="font-display mt-3 max-w-3xl text-balance text-[44px] leading-[0.98] sm:text-[56px]">
        {group.name}
      </h1>

      <div className="mt-8 max-w-2xl rounded-[24px] border border-line bg-surface p-6 sm:p-8">
        <span className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-[12px] text-accent">
          <Hourglass className="size-3.5" aria-hidden /> Waiting for approval
        </span>
        <h2 className="font-display mt-4 text-balance text-[30px] leading-tight">
          Your request is with the stewards.
        </h2>
        <p className="mt-3 text-[14px] leading-relaxed text-muted">
          You asked to join {group.name}
          {group.requestedAt ? ` on ${formatClosingDate(group.requestedAt, 'long')}` : ''}. A steward
          of this group reviews requests; until one approves, the roster and its group buys stay
          private to members.
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-faint">
          Nothing is emailed yet, so check back here after a neighbour has had a chance to review
          it. You can withdraw the request at any time.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <CancelRequestButton societyId={group.id} />
          <ButtonLink href="/for-you" variant="secondary">
            Browse other groups <ArrowRight />
          </ButtonLink>
        </div>
      </div>
    </Container>
  )
}

export default async function GroupRosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const result = await fetchGroupRoster(id)

  if (!result.ok && result.status === 404) notFound()

  if (!result.ok) {
    if (result.status === 401) {
      return (
        <MessageState
          eyebrow="Group"
          title="Sign in to see your group"
          body="Membership is tied to your account, so the roster is only shown to signed-in members."
          actions={
            <ButtonLink href={`/login?next=/groups/${id}`}>
              Sign in <ArrowRight />
            </ButtonLink>
          }
        />
      )
    }

    if (result.status === 403) {
      const membership = await fetchGroupMembership(id)
      if (membership.ok && membership.group.status === 'PENDING') {
        return <PendingState group={membership.group} />
      }
      if (!membership.ok && membership.status === 404) {
        return (
          <MessageState
            eyebrow="Group"
            title="You are not in this group yet"
            body="Membership is scoped to one society and starts with a request. Find your society and ask to join; a steward there reviews it before you can see the roster."
            detail="If you already asked, sign in with the same account — pending requests are tied to it."
            actions={
              <>
                <ButtonLink href="/for-you">
                  Find your group <ArrowRight />
                </ButtonLink>
                <ButtonLink href={`/login?next=/groups/${id}`} variant="secondary">
                  Use another account
                </ButtonLink>
              </>
            }
          />
        )
      }
    }

    return (
      <MessageState
        eyebrow="Group"
        title="This group could not be loaded"
        body={result.message}
        actions={
          <ButtonLink href="/for-you">
            Browse groups <ArrowRight />
          </ButtonLink>
        }
      />
    )
  }

  const { roster } = result
  const viewer = await getCurrentUser()
  const isSteward = roster.viewerRole === 'STEWARD'
  const waiting = roster.pendingRequests.length

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
        You are {isSteward ? 'a steward' : 'a member'} of this group. A role only applies to this
        society: being a steward elsewhere grants nothing here, and no email addresses are shown.
      </p>

      <dl className="mt-8 grid max-w-md grid-cols-2 gap-3">
        <Stat label="Active members" value={roster.society.memberCount} />
        {isSteward && <Stat label="Requests waiting" value={waiting} highlight />}
      </dl>

      <div className="mt-10 max-w-3xl">
        <ResidenceClaimForm
          societyId={roster.societyId}
          claim={roster.viewerVerification}
          societyName={roster.society.name}
        />
      </div>

      {isSteward && (
        <section aria-labelledby="requests-heading" className="mt-12 max-w-3xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="requests-heading" className="font-display text-[30px] leading-none">
                Waiting for you
              </h2>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
                A request becomes membership only when you approve it. Until then the account sees
                the group name but not the roster or its group buys.
              </p>
            </div>
            <span className="rounded-full border border-line-strong px-3 py-1 text-[12px] tabular-nums text-muted">
              {waiting} waiting
            </span>
          </div>

          {waiting === 0 ? (
            <p className="mt-4 rounded-[18px] border border-dashed border-line-strong px-4 py-6 text-[13px] text-muted">
              No requests right now. New neighbours will appear here when they ask to join.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {roster.pendingRequests.map((request) => (
                <li key={request.userId} className="rounded-[18px] border border-line bg-surface p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[14px] font-medium">{request.name}</p>
                      <p className="mt-0.5 text-[12.5px] text-muted">
                        Asked {formatClosingDate(request.requestedAt, 'long')}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] text-accent">
                      Pending
                    </span>
                  </div>
                  <div className="mt-3">
                    <JoinRequestControls
                      societyId={roster.societyId}
                      userId={request.userId}
                      name={request.name}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {isSteward && (
        <section aria-labelledby="residence-queue-heading" className="mt-12 max-w-3xl">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="residence-queue-heading" className="font-display text-[30px] leading-none">
                Residence claims
              </h2>
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
                Neighbours who declared a block, unit and tenure. Verifying confirms the address
                within this group only; it is not an identity check. You cannot review your own
                claim — another steward has to do that.
              </p>
            </div>
            <span className="rounded-full border border-line-strong px-3 py-1 text-[12px] tabular-nums text-muted">
              {roster.verificationQueue.length} waiting
            </span>
          </div>

          {roster.verificationQueue.length === 0 ? (
            <p className="mt-4 rounded-[18px] border border-dashed border-line-strong px-4 py-6 text-[13px] text-muted">
              No claims waiting. Members can add their address from this page.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {roster.verificationQueue.map((request) => {
                const ownClaim = viewer?.id === request.userId
                return (
                  <li
                    key={request.userId}
                    className="rounded-[18px] border border-line bg-surface p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium">
                          {request.name}
                          {ownClaim && <span className="ml-2 text-[12px] text-faint">you</span>}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-fg">
                          <MapPin className="size-3.5 shrink-0 text-muted" aria-hidden />
                          <span className="truncate">
                            {request.block ? `${request.block}, ` : ''}
                            {request.unit}
                          </span>
                        </p>
                        <p className="mt-0.5 text-[12.5px] text-muted">
                          {TENANCY_LABEL[request.tenancy]} · claimed{' '}
                          {formatClosingDate(request.submittedAt, 'long')}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11.5px] text-accent">
                        Pending
                      </span>
                    </div>
                    <div className="mt-3">
                      {ownClaim ? (
                        <p className="text-[12.5px] leading-relaxed text-muted">
                          Another steward must confirm your own claim before it can be verified.
                        </p>
                      ) : (
                        <ResidenceReviewControls
                          societyId={roster.societyId}
                          userId={request.userId}
                          name={request.name}
                        />
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      <section aria-labelledby="members-heading" className="mt-12 max-w-3xl">
        <div className="flex items-end justify-between gap-3">
          <h2 id="members-heading" className="font-display text-[30px] leading-none">
            Members
          </h2>
          <p className="text-[12.5px] tabular-nums text-muted">
            {roster.members.length} {roster.members.length === 1 ? 'person' : 'people'}
          </p>
        </div>

        <ul className="mt-4 divide-y divide-line border-y border-line">
          {roster.members.map((member) => {
            const isViewer = viewer?.id === member.userId
            return (
              <li
                key={member.userId}
                className="flex flex-wrap items-center justify-between gap-4 py-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-medium text-muted"
                  >
                    {member.name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[15px]">
                      <span className="truncate">{member.name}</span>
                      {isViewer && <span className="text-[12px] text-faint">you</span>}
                      <RoleBadge role={member.role} />
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
                      <span>Joined {formatClosingDate(member.joinedAt, 'long')}</span>
                      <VerificationStatusBadge status={member.verificationStatus} />
                    </p>
                  </div>
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

        <p className="mt-4 text-[12.5px] leading-relaxed text-muted">
          {isSteward
            ? 'You cannot change your own role, and a group always keeps at least one steward.'
            : 'Stewards manage this roster. Ask one of them if something here needs to change.'}
        </p>
      </section>

      {isSteward && (
        <section aria-labelledby="activity-heading" className="mt-12 max-w-3xl">
          <h2 id="activity-heading" className="font-display text-[30px] leading-none">
            Recent activity
          </h2>
          <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-muted">
            An append-only record of joins, decisions and role changes. Nobody can edit or delete
            these events, including stewards.
          </p>
          <div className="mt-4 rounded-[20px] border border-line bg-surface p-5 sm:p-6">
            <AuditTimeline entries={roster.auditTrail} />
          </div>
        </section>
      )}
    </Container>
  )
}
