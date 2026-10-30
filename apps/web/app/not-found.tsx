import { ButtonLink, Container } from '@/components/ui'

export default function NotFound() {
  return (
    <Container className="pt-16 sm:pt-24">
      <div className="mx-auto max-w-md text-center">
        <p className="text-[14px] text-muted">404</p>
        <h1 className="font-display mt-3 text-[44px] leading-[1.02] sm:text-[56px]">This page is not in the basket</h1>
        <p className="mt-4 text-[16px] leading-relaxed text-muted">
          The campaign or product may have closed, or the address is wrong. Sample campaigns and the catalogue are always one click away.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/campaigns">Browse group buys</ButtonLink>
          <ButtonLink href="/shop" variant="secondary">Shop the catalogue</ButtonLink>
        </div>
      </div>
    </Container>
  )
}
