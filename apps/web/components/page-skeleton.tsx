import { Container } from './ui'

/**
 * Route-level placeholder shown while a server component streams. It mirrors
 * the shape of the catalogue pages so the layout does not jump on arrival.
 */
export function PageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <Container className="pt-10 sm:pt-14" aria-busy="true">
      <p role="status" className="sr-only">
        Loading…
      </p>
      <div className="h-4 w-24 animate-pulse rounded-full bg-surface-2" />
      <div className="mt-4 h-12 w-full max-w-md animate-pulse rounded-[14px] bg-surface-2" />
      <div className="mt-3 h-4 w-full max-w-lg animate-pulse rounded-full bg-surface-2" />
      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3">
        {Array.from({ length: cards }).map((_, index) => (
          <div key={index} className="flex flex-col gap-3">
            <div className="aspect-[4/3] animate-pulse rounded-card bg-surface-2" />
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-surface-2" />
            <div className="h-4 w-1/2 animate-pulse rounded-full bg-surface-2/70" />
          </div>
        ))}
      </div>
    </Container>
  )
}
