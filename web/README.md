# TrancheTrade — web

Next.js 15 App Router interface for the TrancheTrade senior/junior waterfall. Server Components are
the default; `use client` appears only on interactive leaves.

## Install, develop, build

```
npm install
npm run dev
npm run build
npm run start
npm run typecheck
```

`npm run typecheck` runs `tsc --noEmit` under `strict` with `noUncheckedIndexedAccess`.

## Routes

| Route | Renders |
|---|---|
| `/` | Pool view — hero, two tranche panels, deposit form, beat region (cascade or rejection), recent activity |
| `/activity` | Full audit trail, allocations and rejections in chronological order |
| `/activity/[cycleId]` | One cycle traced across Sepolia, Attestcoin, and Creditcoin CC3 |

## Data sources

The interface reads three files and one chain.

| Source | Path | Used for |
|---|---|---|
| Deployment book | `docs/evidence/deployments.json` | Contract addresses and the configured tranche caps |
| ABIs | `docs/evidence/abi/*.json` | Contract reads, event decoding, revert decoding |
| Live manifest | `docs/evidence/transactions.json` | Cross-chain cycle records written by the Integration Engineer |
| Fixture manifest | `fixtures/transactions.fixture.json` | Offline development before the live manifest carries cycles |
| Creditcoin CC3 | `config/networks.json` RPC | `snapshot()`, `trancheCount()`, rates, `positionOf`, and live allocation logs |

`src/lib/manifest.ts` selects between the live and fixture manifests. It prefers the live manifest as
soon as it carries at least one cycle, and falls back to the fixture otherwise. Whenever the fixture
is in use, or no contract address is recorded, `ProvenanceNotice` states so at the top of every page
and every hash renders as unlinked muted text rather than as a link to a transaction that does not
exist. No transaction hash, address, or balance in this repository is fabricated as if it were real.

## Environment variables

Only one is read, and it is optional and public.

| Name | Values | Effect |
|---|---|---|
| `NEXT_PUBLIC_DATA_SOURCE` | `live` \| `fixture` | Forces the manifest source. Unset means automatic selection. |

There is no secret in this application. No `.env*` file is read by any code path here.

## CORS fallback

Not needed, and not built. There is no Route Handler in `src/app`. Live allocation polling runs in
the browser against the CC3 RPC from `CascadeController`, and it only starts once
`docs/evidence/deployments.json` records a `TrancheWaterfall` address — no address is recorded yet,
so the poll is inert in this build. If the CC3 RPC turns out to refuse browser origins once an
address exists, add `src/app/api/pool/route.ts` performing the identical read server-side, with no
business logic, and record the refusing CORS response in this section.

## The two load-bearing components

`src/components/CascadeController.tsx` — PRD Feature 5. Beats are taken from the on-chain ordering of
`SeniorAllocated` and `JuniorAllocated` (`deriveBeatsFromEventLogOrder` in `src/lib/beats.ts`) and
played in that order, never inferred from a balance difference. With motion available, beat one
sweeps and counts for 900 ms, nothing moves for 300 ms, then beat two sweeps and counts for 900 ms;
only one panel is ever in motion. Under `prefers-reduced-motion: reduce` there is no sweep and no
counting — beat one lands instantly, 700 ms of stillness follow, then beat two lands, and both are
announced sequentially through one `aria-live="polite"` region. The second beat runs even when the
junior allocation is zero.

`src/components/RejectionBeat.tsx` — PRD Feature 6. It renders `REJECTION_MESSAGE` from
`src/lib/copy.ts`, the decoded `AttestationFailed(id, reason)`, both tranche balances as
before → after with the word `unchanged`, and a link to the reverted CC3 transaction. It occupies the
same region as the cascade and is never shown at the same time. There is no spinner, no automatic
resubmission, and no transient notification anywhere in it.

## Design system

Tokens live in `tailwind.config.ts`, split into `inventoriedFromReference` and
`extendedForTrancheTrade` so the museum reference's own values stay distinguishable from the
TrancheTrade extensions. Component classes are in `src/app/globals.css`. Border radius is `0`
everywhere and the status sticker's shadow is the only shadow in the application.
