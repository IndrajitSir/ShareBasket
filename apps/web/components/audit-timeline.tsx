import type { AuditEntry } from '@/lib/groups'
import { formatClosingDate } from '@/lib/format'

function actor(entry: AuditEntry): string {
  return entry.actorName ?? 'A steward'
}

function sentence(entry: AuditEntry): string {
  switch (entry.action) {
    case 'MEMBERSHIP_REQUESTED':
      return `${entry.targetName} asked to join.`
    case 'MEMBERSHIP_APPROVED':
      return `${actor(entry)} approved ${entry.targetName}.`
    case 'MEMBERSHIP_REJECTED':
      return `${actor(entry)} declined ${entry.targetName}'s request.`
    case 'MEMBERSHIP_LEFT':
      return `${entry.targetName} left the group.`
    case 'ROLE_CHANGED':
      return entry.toRole === 'STEWARD'
        ? `${actor(entry)} made ${entry.targetName} a steward.`
        : `${actor(entry)} changed ${entry.targetName} to member.`
    case 'STEWARD_BOOTSTRAPPED':
      return `${entry.targetName} started this group as its steward.`
    case 'STEWARD_SUCCEEDED':
      return `${entry.targetName} became steward when the previous one left.`
    default:
      return `${entry.targetName}: ${entry.action}`
  }
}

const DOT_TONE: Record<AuditEntry['action'], string> = {
  MEMBERSHIP_REQUESTED: 'bg-line-strong',
  MEMBERSHIP_APPROVED: 'bg-[#4d6c51]',
  MEMBERSHIP_REJECTED: 'bg-accent',
  MEMBERSHIP_LEFT: 'bg-faint',
  ROLE_CHANGED: 'bg-fg',
  STEWARD_BOOTSTRAPPED: 'bg-[#4d6c51]',
  STEWARD_SUCCEEDED: 'bg-[#4d6c51]',
}

/**
 * Read-only view of the append-only trail. Entries cannot be edited or deleted;
 * this component only renders what the API returned, newest first.
 */
export function AuditTimeline({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) {
    return <p className="mt-4 text-[13px] text-muted">No membership activity yet.</p>
  }

  return (
    <ol className="mt-5 space-y-3.5">
      {entries.map((entry) => (
        <li key={entry.id} className="flex gap-3">
          <span
            className={`mt-[6px] size-2 shrink-0 rounded-full ${DOT_TONE[entry.action]}`}
            aria-hidden
          />
          <div className="min-w-0 text-[13px] leading-snug">
            <p>{sentence(entry)}</p>
            <time dateTime={entry.createdAt} className="text-[12px] text-faint">
              {formatClosingDate(entry.createdAt, 'long')}
            </time>
          </div>
        </li>
      ))}
    </ol>
  )
}
