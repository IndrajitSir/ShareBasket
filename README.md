# ShareBasket — community group buying (prototype)

A community bulk-buying marketplace for residential societies. Neighbours pool
demand for everyday essentials, see every quantity price tier up front, and
track progress toward each group minimum.

The product specification lives in [`docs/`](docs/README.md); start with
[`docs/PRODUCT.md`](docs/PRODUCT.md) and [`docs/TODO.md`](docs/TODO.md).

## What works today

- **Campaign discovery** at `/campaigns`: filter by community and category, sort
  by closing date or progress, and see the current tier price per campaign.
- **Campaign detail** at `/campaigns/:slug`: all price tiers, current tier,
  unit progress against the group minimum, deadline and sample delivery date.
- **Read-only campaign API**: `GET /api/campaigns` and
  `GET /api/campaigns/:slug`, both served by the Worker and tagged
  `previewOnly: true`.
- **Server-side tier pricing** in integer paise, with focused unit tests.

## What is deliberately not live

The campaign data is sample data shipped with the app. There are no accounts, no
persisted commitments, no stock reservation, no payments and no verified
suppliers. The catalogue shop and demo checkout are leftover starter-store
surfaces, not marketplace functionality. Nothing here should be presented as a
real offer, real saving, or real order.

## Run it

```sh
bun install
bun run dev        # http://localhost:5173
bun run test       # focused campaign/pricing/API tests
bun run typecheck  # strict TypeScript, no emit
bun run build      # dist/client (assets) + dist/store/index.js (Worker)
```

## Layout

- `src/data/campaigns.ts` — sample campaigns plus tier-pricing and progress
  helpers. Money is integer paise; formatting is `en-IN` rupees.
- `src/data/products.ts` — the product catalogue backing campaigns.
- `src/app/pages/*` — screens; `src/app/components/*` — nav, bag, cards, footer.
- `src/worker/index.ts` — Hono Worker: campaign preview API, legacy demo order
  and newsletter handlers, then static assets.
- `tests/campaigns.test.mjs` — tier boundaries, progress, and API contract.

## Deploy with Freebuff Sites

`deploy.json` points at the build output. After `bun run build`, deploy with the
`sites_deploy` tool from this directory.
