import Link from 'next/link'

import { Logo } from './nav'
import { Container } from './ui'

const columns = [
  {
    title: 'Shop',
    links: [
      ['All products', '/shop'],
      ['Pantry', '/shop?category=pantry'],
      ['Ceramics', '/shop?category=ceramics'],
      ['Textiles', '/shop?category=textiles'],
      ['Lighting', '/shop?category=lighting'],
    ],
  },
  {
    title: 'Community',
    links: [
      ['Group buys', '/campaigns'],
      ['How it works', '/about'],
      ['Sample data', '/about'],
    ],
  },
  {
    title: 'Project',
    links: [
      ['About', '/about'],
      ['API docs', '/about'],
      ['Deployment', '/about'],
    ],
  },
]

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <Container className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.3fr_1fr]">
          <div className="max-w-md">
            <h2 className="font-display text-[36px] leading-[1.05]">Buying together, without the guesswork</h2>
            <p className="mt-3 text-[15px] leading-relaxed text-muted">
              Every campaign shows its tiers, threshold and delivery date up front. This preview uses sample data; ordering and payments are not enabled.
            </p>
            <p className="mt-6 text-[13px] text-faint">
              Questions about the project? Ask the maintainer of this repository.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6">
            {columns.map((column) => (
              <div key={column.title}>
                <p className="text-[13px] font-medium">{column.title}</p>
                <ul className="mt-4 flex flex-col gap-2.5">
                  {column.links.map(([label, href]) => (
                    <li key={label}>
                      <Link href={href} className="text-[14px] text-muted transition-colors hover:text-fg">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-16 flex flex-col-reverse items-start justify-between gap-4 border-t border-line pt-6 sm:flex-row sm:items-center">
          <p className="text-[13px] text-faint">© {new Date().getFullYear()} ShareBasket. Sample preview — no live orders.</p>
          <Logo className="text-muted" />
        </div>
      </Container>
    </footer>
  )
}
