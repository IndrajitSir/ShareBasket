import { Container } from '@/components/ui'

export default function GroupLoading() {
  return (
    <Container className="pb-24 pt-10 sm:pt-16" aria-busy="true">
      <p role="status" className="sr-only">
        Loading group…
      </p>
      <div className="h-4 w-40 animate-pulse rounded-full bg-surface-2" />
      <div className="mt-4 h-12 w-full max-w-sm animate-pulse rounded-[14px] bg-surface-2" />
      <div className="mt-8 grid max-w-md grid-cols-2 gap-3">
        <div className="h-20 animate-pulse rounded-[16px] bg-surface-2" />
        <div className="h-20 animate-pulse rounded-[16px] bg-surface-2/70" />
      </div>
      <div className="mt-12 flex max-w-3xl flex-col gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 border-b border-line pb-4">
            <div className="size-9 shrink-0 animate-pulse rounded-full bg-surface-2" />
            <div className="flex-1">
              <div className="h-4 w-40 animate-pulse rounded-full bg-surface-2" />
              <div className="mt-2 h-3 w-28 animate-pulse rounded-full bg-surface-2/70" />
            </div>
          </div>
        ))}
      </div>
    </Container>
  )
}
