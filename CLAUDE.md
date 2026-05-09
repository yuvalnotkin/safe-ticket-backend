# Safe Ticket — Backend

## What This Is
API server for Safe Ticket: a secondary ticket marketplace for verified ticket resale at face value only. Israeli market, sports and cultural events. Handles auth, listings, search, transactions, payments, escrow, and provider connectors.

## The Problem We're Solving
Today's secondary ticket market suffers from low trust, fraud, and scalping. Buyers can't tell if a ticket is real or transferable. Sellers resort to Facebook groups and WhatsApp with no payment protection. Clubs and promoters lose control of pricing and the customer relationship. There's no platform that connects to the *official* transfer mechanisms of ticketing providers and enforces fair pricing.

Safe Ticket is the trust layer: a search engine + marketplace where every ticket is verified through the original provider, every resale happens at face value, and funds are held in escrow until ownership transfer is officially confirmed.

## Who Uses It
- **Sellers** — bought a ticket, can't attend, want to resell safely without manual coordination or fear of non-payment.
- **Buyers** — want a ticket to a high-demand event without risking fraud, fake tickets, or invalid transfers.
- **Ticketing providers / clubs / promoters** (Phase 5+) — partners who supply official verification and transfer APIs and benefit from a controlled secondary market.

## How a Transaction Works
1. Seller authenticates with a supported ticketing provider through that provider's official mechanism.
2. System pulls the seller's verified tickets and their transfer eligibility.
3. Seller picks a ticket and confirms the listing. Price is locked to the verified face value — seller cannot change it.
4. Buyer searches, finds the listing, pays through the platform.
5. Funds enter escrow. Listing is reserved. Buyer's payment is *not* released to the seller yet.
6. System initiates the official ownership transfer through the provider's connector.
7. When the provider confirms transfer completion, escrow releases the seller's payout. Transaction completes.
8. If transfer fails or times out, escrow refunds the buyer. Listing may return to active.

After ownership transfer, any future refund (cancellation, postponement) is handled by the ticketing provider directly with the new owner, per the provider's policy.

## Business Model
Both buyer and seller pay a fixed-percentage service fee per completed transaction. Ticket price itself is locked to face value. Platform revenue = buyer fee + seller fee. Fees are shown separately and transparently in the UI.

## System Principles (non-negotiable)
1. **Official-only** — only verified tickets from supported providers; no manual upload flows.
2. **Trust through state** — never rely on user declarations. Every critical action must reflect a proven, recorded state (verified, eligible, paid, transferred).
3. **Money moves last** — no payout to the seller before `transfer_completed` is confirmed.
4. **Verifiability over coverage** — if a provider can't support fast, reliable, official verification, we don't support that provider.
5. **Provider abstraction** — every provider sits behind a unified connector interface. Provider-specific quirks must not leak into the rest of the system.

## Out of Scope (MVP)
Auction/bidding, dynamic pricing, buyer-seller chat, international sales, multi-currency, partial ticket splitting, recommendation engine, advanced refund orchestration, providers without official fast verification. Israel only. Sports + culture only.

## Multi-Repo Project — Where You Sit

This repo (`safe-ticket-backend`) is one of three. The full project:

- **`safe-ticket-orchestrator`** — the human's tech-lead workspace. Owns `API_CONTRACT.md` (canonical), all phase plans, all ADRs, all dispatched executor prompts, and `STATUS.md` (the live progress tracker across both executors). You don't have read access to it. The human pastes prompts from there into your session.
- **`safe-ticket-frontend`** — Next.js on Vercel. Renders the user-facing UI. Calls your endpoints at `NEXT_PUBLIC_API_BASE_URL`. Never imports the Supabase JS SDK and never talks to Supabase, payment processors, or ticketing providers directly — every external integration goes through you. A separate Claude Code agent works in that repo.
- **`safe-ticket-backend`** — this repo. Owns the database (hosted Supabase), auth (issues Supabase JWTs the frontend carries as bearer tokens), every endpoint the frontend calls, every provider connector, escrow + payout logic.

The only file that crosses repo boundaries is `API_CONTRACT.md` — it's byte-synced into all three. Treat it as canonical and read-only here.

## Tech Stack
- Node.js + Express.js with TypeScript
- Supabase (PostgreSQL + Supabase Auth)
- Deployed on Railway (auto-deploy from `main`)

## File Structure
```
src/
  routes/       → Express route handlers
  services/     → Business logic
  models/       → Type definitions + DB query functions
  connectors/   → Provider integrations (mock now, real later)
  middleware/   → Auth, validation, error handling
  utils/        → Helpers, constants, fee calculations
```

## Lifecycle State Machines
Listings, transactions, and transfers each have explicit state machines. Use a single `status` field per entity with an enum — never boolean flags standing in for state.

- **Listing**: `draft` → `verified_ready` → `active` → `reserved` → `sold` / `removed` / `expired`
- **Transaction**: `initiated` → `payment_pending` → `payment_authorized` → `escrow_held` → `transfer_pending` → `transfer_in_progress` → `transfer_completed` → `payout_pending` → `completed` (plus `failed` / `cancelled` / `refunded` paths)
- **Transfer**: `pending` → `initiated` → `provider_processing` → `completed` / `failed`

Transitions must be validated. Skipping states or moving backwards is a bug.

## Connector Interface
Every provider integration sits behind a unified interface:
`startAuth()`, `listTickets()`, `verifyOwnership()`, `checkTransferEligibility()`, `initiateTransfer()`, `getTransferStatus()`
Resolved via factory: `getConnector(providerId)`. Mock connector in Phase 3, real ones in Phase 5+.

## Standing Rules
- All endpoints return JSON.
- Auth via Supabase JWT in `Authorization` header.
- Validate all inputs with zod (or equivalent).
- Log every state transition (audit trail).
- Never expose provider auth tokens to clients.
- Face value is immutable. Sellers cannot set or edit ticket price anywhere.
- Escrow releases funds only after `transfer_completed`.
- Use row-level locking when reserving a listing — prevent race conditions between concurrent buyers.
- Money is never stored as floats. Use integers (cents/agorot) or fixed-precision types.
- Commit per feature with descriptive messages.

## Workflow — Branch + PR + Squash Merge

`main` is branch-protected on GitHub: PR required, no force pushes, no deletions, admins enforced. **Direct push to `main` is blocked at the platform layer** — it is not a soft convention. This was put in place after a subagent unauthorized-pushed during Phase 2 segment 3; both executor repos now match.

For every segment of work:

1. Create a feature branch named `phase-<N>/segment-<M>-<slug>` (e.g. `phase-2/segment-4-profile`).
2. Commit per logical change with descriptive messages. TDD-shaped histories (test commit → impl commit) are the established discipline since segment 3.
3. Push the branch.
4. Open a PR against `main`. PR title format: `Phase <N> segment <M>: <short outcome>`. Body covers what changed, how to test (curl examples for new endpoints), anything tricky to look at.
5. The human reviews and squash-merges. **You do not merge your own PRs.**
6. Railway auto-deploys from `main` after merge.

If you dispatch subagents (Superpowers `subagent-driven-development` etc.), the subagent's prompt must explicitly forbid `git push` — the parent agent owns all pushes. Defense in depth on top of branch protection.

## Verification Model

When you report a segment "done," that is *not* the authoritative completion signal. The orchestrator runs an independent verification before flipping the segment to ✅ in `STATUS.md` (which lives in the orchestrator repo, not here). Their checklist:

1. Diff your branch against `API_CONTRACT.md` — flag any drift.
2. Curl an endpoint **new to this segment** against the live Railway deploy. `/api/health` passing proves Express is running, *not* that your latest code is deployed — `/api/health` has existed since the first commit. Always hit a route the segment added.
3. Walk the full `TESTING.md` checklist for the segment.
4. If anything fails, walk the production checklist in `TESTING.md` (Railway active deploy commit, env vars, Public Networking target port, hosted Supabase migrations + seed) before assuming a code bug — those four items have each silently broken at least once.

So when you finish a segment: ship it, open the PR, paste your test output and curl examples in the PR body, then *stand by* — don't assume the work is closed until you hear back. If the orchestrator finds drift or a verification failure, you'll be asked to fix it forward on the same branch (no force-push rollbacks).

`STATUS.md` lives in the orchestrator repo and is owned by the orchestrator. **Don't try to update it from here** — you don't have access, and even if you did, your status report is not the source of truth, the orchestrator's verification is.

`API_CONTRACT.md` is also orchestrator-owned. If you find a gap, ambiguity, or drift between contract and reality, surface it back to the human and the orchestrator updates it. A local edit will be overwritten on the next sync.

## Superpowers

You have the Superpowers skill set. Use the relevant skills proactively:

- `test-driven-development` — established discipline since segment 3 (89/89 passing on segment 3, clean TDD histories on segments 3 and 4). Use it for every non-trivial module: routes, services, validators, connector logic, anything with branching or state transitions.
- `verification-before-completion` — before reporting any segment done. Run the build, the type checker, the tests. Paste actual command output in the PR — don't claim success from memory.
- `brainstorming` — when a prompt is creative or ambiguous (state-machine design, escrow rules, transfer retry semantics) and the right move isn't obvious.
- `subagent-driven-development` / `dispatching-parallel-agents` — when a segment splits cleanly into independent tasks. Subagent prompts must forbid `git push` (see Workflow section).

## Working With Me
- Describe the problem, not the solution. I'll tell you the outcome; you figure out how.
- If something is ambiguous or contradictory, ask.
- If you think a constraint is wrong, say so. Better to argue now than refactor later.
- For meaningful design decisions (schema choices, auth strategy, anything with long-term consequences), pause and ask before committing.

## API Contract
`API_CONTRACT.md` is the canonical source for every endpoint, request/response shape, error envelope, and validation rule. Owned by the orchestrator and synced in. See the Verification Model section for how contract drift is handled.

## Current Phase
**Phase 2 — Backend Core: complete ✅** as of 2026-05-09. All four segments shipped, deployed, and live-verified (schema + seed, auth, search + listing detail, profile). Phase 3 (seller flow — connector interface, sell endpoints, listing management) is technically unblocked but held until the frontend Phase 2 integration is at least mid-flight, so we don't accumulate untested API surface. The orchestrator dispatches the next segment when it's time.
