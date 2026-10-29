import { ButtonLink, Container, Reveal } from '../components/ui'

export function About() {
  return (
    <Container className="pt-10 sm:pt-16">
      <div className="max-w-3xl">
        <p className="text-[14px] text-muted">The studio</p>
        <h1 className="font-display mt-3 text-balance text-[48px] leading-[1] sm:text-[72px]">A small shop for things made by hand, kept for years</h1>
      </div>
      <Reveal className="image-frame mt-12 aspect-[16/9] rounded-[32px]">
        <img src="/images/lookbook.jpg" alt="A sunlit corner of the studio" className="size-full object-cover" />
      </Reveal>
      <div className="mt-16 grid gap-12 lg:grid-cols-[1fr_2fr]">
        <Reveal>
          <p className="font-display text-[32px] leading-[1.1]">We started in 2019 with a kiln, a loom and a lot of patience.</p>
        </Reveal>
        <Reveal delay={0.1} className="flex flex-col gap-5 text-[17px] leading-relaxed text-muted">
          <p>
            Your Store began as a corner of a ceramics studio in Lisbon, selling seconds to friends. It grew the way we hope everything we sell does: slowly, and because people kept coming back.
          </p>
          <p>
            Today we work with eleven makers across Portugal, Japan and the Pacific Northwest. We visit every workshop, we agree prices together, and we never ask anyone to make more than they want to.
          </p>
          <p>
            Everything ships from our studio in recycled packaging. If something arrives and is not right, tell us and we will fix it.
          </p>
          <ButtonLink to="/shop" className="mt-2 self-start">
            Shop the collection
          </ButtonLink>
        </Reveal>
      </div>
      <dl className="mt-20 grid gap-8 border-t border-line pt-10 sm:grid-cols-3">
        {[
          ['Makers', '11'],
          ['Countries', '3'],
          ['Pieces returned last year', '0.8%'],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="text-[14px] text-muted">{label}</dt>
            <dd className="font-display mt-2 text-[48px] leading-none">{value}</dd>
          </div>
        ))}
      </dl>
    </Container>
  )
}
