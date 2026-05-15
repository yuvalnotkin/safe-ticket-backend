# Safe Ticket — API Contract

Shared between frontend and backend repos. Keep in sync.

## Base URL

- Local: `http://localhost:3001/api`
- Production: TBD (Railway URL)

## Auth

All protected endpoints require: `Authorization: Bearer <supabase_jwt_token>`

## Endpoints

### Health

`GET /api/health` → `{ status: "ok" }`

### Auth (Phase 2)

#### POST /api/auth/signup

Creates a user, creates their profile row, returns a session. No email
confirmation step (local dev / MVP).

Request:

```json
{
  "email": "user@example.com",
  "password": "min-8-chars",
  "displayName": "Aviv Cohen"
}
```

Response 201:

```json
{
  "user": { "id": "<uuid>", "email": "user@example.com", "displayName": "Aviv Cohen" },
  "session": {
    "accessToken": "<jwt>",
    "refreshToken": "<token>",
    "expiresAt": 1777281113
  }
}
```

Errors: `400 invalid_request` (validation), `400 signup_failed` (e.g. email
already registered).

#### POST /api/auth/login

Request:

```json
{ "email": "user@example.com", "password": "..." }
```

Response 200: same shape as signup.

Errors: `400 invalid_request`, `401 invalid_credentials`.

#### POST /api/auth/logout

Requires `Authorization: Bearer <jwt>`. Revokes the session globally — the
access token and its refresh token both stop working.

Response: `204 No Content`.

Errors: `401 unauthorized`.

#### GET /api/auth/me

Requires `Authorization: Bearer <jwt>`. Returns the user merged with their
profile row.

Response 200:

```json
{
  "id": "<uuid>",
  "email": "user@example.com",
  "displayName": "Aviv Cohen",
  "phone": "+972-50-1234567",
  "avatarUrl": null,
  "createdAt": "2026-04-27T05:29:06.977097+00:00",
  "updatedAt": "2026-04-27T05:29:06.977097+00:00"
}
```

Errors: `401 unauthorized`, `404 user_not_found`.

#### Error envelope

All non-2xx responses use:

```json
{ "error": { "code": "<machine_code>", "message": "<human message>", "details": [...] } }
```

`details` is present only for `invalid_request` and contains the Zod issue list. Each issue object always carries at minimum:

- `code`: machine identifier for the issue type (e.g., `"invalid_format"`, `"too_small"`, `"unrecognized_keys"`).
- `path`: array of field names locating the offending value (e.g., `["phone"]`, `["price", "faceValueAgorot"]`).
- `message`: human-readable explanation.

Issues may also carry contextual keys depending on `code` — Zod adds fields like `origin`, `format`, `pattern`, `minimum`, `maximum`, `keys`. Consumers **must read `path` + `message` and tolerate any additional keys**; do not validate the issue shape exhaustively.

**`unrecognized_keys` special case.** When the request body contains a key outside a strict object's allowlist, the issue uses `path: []` (the unknown key is not on a known path) and reports the offending key(s) in a separate `keys` field:

```json
{ "code": "unrecognized_keys", "keys": ["email"], "path": [], "message": "Unrecognized key: \"email\"" }
```

Consumers wanting to surface this should detect by `code === "unrecognized_keys"`, not by `path`. (Surfaced 2026-05-12 during frontend Phase 2 segment 4 verification.)

### Search (Phase 2)

#### Money representation

Every monetary value in this API is an integer in **agorot** (1 ILS = 100 agorot). Field names always end with `Agorot`. Floats are never used for money, anywhere.

#### Service fee

The buyer service fee is **10% of face value, integer-truncated** (`Math.floor(faceValueAgorot * 0.10)`). Truncation is always *down* — the platform never rounds up against the buyer. Total price the buyer pays is `faceValueAgorot + serviceFeeAgorot`.

Example: `faceValueAgorot = 22000` → `serviceFeeAgorot = 2200` → total = `24200`.

The seller-side service fee will be added in Phase 4 alongside payouts; until then, only the buyer fee is exposed.

#### Listing object

Returned by both the list and detail endpoints.

```json
{
  "id": "<uuid>",
  "status": "active",
  "event": {
    "name": "Hapoel TLV vs. Maccabi",
    "date": "2026-06-15T20:00:00.000Z",
    "venue": "Bloomfield Stadium",
    "city": "Tel Aviv",
    "category": "sports"
  },
  "seat": {
    "section": "5",
    "row": "12",
    "seat": "8"
  },
  "price": {
    "faceValueAgorot": 25000,
    "serviceFeeAgorot": 2500
  },
  "provider": "ticketmaster",
  "createdAt": "2026-04-30T08:00:00.000Z"
}
```

- `category` is `"sports" | "culture"`. The DB models a finer-grained `event_type` (`sport | concert | theater | festival | other`); the API folds everything that isn't `sport` into `culture`.
- `provider` is one of the supported provider slugs (currently `"eventim_il" | "hala" | "leaan" | "tmura"`; authoritative list grows alongside connectors). Validation on the `providers` query param is permissive — unknown slugs simply match nothing rather than 400.
- `seat.row` and `seat.seat` are optional (general-admission tickets may omit them).
- `status` is always `"active"` for listings returned in Phase 2 (other states are filtered out).

#### GET /api/listings

Search, filter, sort, paginate active listings. Public — no auth required.

Query parameters (all optional):

| Param            | Type                                   | Notes                                                                           |
| ---------------- | -------------------------------------- | ------------------------------------------------------------------------------- |
| `q`              | string                                 | Free-text match across event name, venue, city. Case-insensitive.               |
| `category`       | `sports` \| `culture`                  |                                                                                 |
| `cities`         | comma-separated strings                | OR within. e.g. `cities=Tel%20Aviv,Haifa`                                       |
| `providers`      | comma-separated provider IDs           | OR within.                                                                      |
| `dateFrom`       | `YYYY-MM-DD`                           | Inclusive. Filters by event day in Asia/Jerusalem time.                         |
| `dateTo`         | `YYYY-MM-DD`                           | Inclusive.                                                                      |
| `minPriceAgorot` | integer                                | Compares against `faceValueAgorot + serviceFeeAgorot` (total).                  |
| `maxPriceAgorot` | integer                                | Same total.                                                                     |
| `sort`           | `soonest` \| `lowestPrice` \| `newest` | Default: `soonest`. `lowestPrice` sorts by total. `newest` by `createdAt` desc. |
| `page`           | integer ≥ 1                            | Default: `1`.                                                                   |
| `limit`          | integer 1–100                          | Default: `20`. Max: `100`.                                                      |

Filters combine with AND across types and OR within (`cities=A,B` AND `providers=X,Y` returns listings in city A or B AND from provider X or Y).

Response 200:

```json
{
  "items": [ /* Listing[] */ ],
  "page": 1,
  "limit": 20,
  "total": 142
}
```

Errors: `400 invalid_request` (validation — bad enum value, malformed date, page<1, limit out of range).

#### GET /api/listings/:id

Returns a single listing by ID. Public — no auth required.

Response 200: a Listing object.

Errors:

- `400 invalid_request` — `id` is not a well-formed UUID. The backend's Zod UUID validation rejects malformed ids before lookup.
- `404 listing_not_found` — `id` is a valid UUID but no row matches, or the row exists but `status` is not `active` in Phase 2.

Clients should treat both as "this listing is not available" — distinguishing "malformed id" from "missing record" is not useful in user-facing UI. (Surfaced 2026-05-11 during frontend Phase 2 segment 2 wiring; the previous contract documented only the 404 path.)

### User Profile (Phase 2)

#### GET /api/users/me/profile

Requires `Authorization: Bearer <jwt>`. Returns the current user's profile — same shape as `GET /api/auth/me`. Provided as a profile-domain endpoint for symmetry with `PUT`; consumers can use either endpoint to read current profile.

Response 200:

```json
{
  "id": "<uuid>",
  "email": "user@example.com",
  "displayName": "Aviv Cohen",
  "phone": "+972-50-1234567",
  "avatarUrl": null,
  "createdAt": "2026-04-27T05:29:06.977097+00:00",
  "updatedAt": "2026-04-27T05:29:06.977097+00:00"
}
```

Errors: `401 unauthorized`, `404 user_not_found`.

#### PUT /api/users/me/profile

Requires `Authorization: Bearer <jwt>`. Partial update of editable profile fields. Every field is optional; fields omitted from the request body are left unchanged. `avatarUrl` accepts `null` to clear an existing value.

The request body is **strictly validated**. Any field outside `displayName`, `phone`, `avatarUrl` is rejected with `400 invalid_request`, code `unrecognized_keys`. This explicitly includes `email` (auth-domain — changed via auth flows, not here).

Request:

```json
{
  "displayName": "Aviv C.",
  "phone": "+972-50-9876543",
  "avatarUrl": "https://example.com/avatars/aviv.jpg"
}
```

Validation:

- `displayName`: string, 1–80 chars after trim.
- `phone`: string or `null`. If string, must match the format `^\+?[0-9 \-]{7,20}$` (digits, spaces, hyphens, optional leading `+`).
- `avatarUrl`: valid URL string or `null`.

Empty body (`{}`) is valid and is a no-op (`updatedAt` is still bumped).

Response 200: same shape as `GET`, reflecting the updated profile.

Errors: `400 invalid_request`, `401 unauthorized`, `404 user_not_found`.

### Seller (Phase 3)

All seller endpoints require `Authorization: Bearer <jwt>` (the Safe Ticket session JWT from Phase 2 auth). The seller's provider access token (issued by Eventim Israel, Hala, Leaan, or Tmura) is stored server-side keyed by `(safeTicketUserId, provider)` and is never exposed to the client. Foundational decision: provider-auth flow is OAuth-style redirect with server-side tokens; see `decisions/0001-provider-auth-flow.md`.

Phase 3 ships a **mock connector** for all four supported provider slugs (`eventim_il` / `hala` / `leaan` / `tmura`). The mock implements the same surface; Phase 5 swaps in real implementations without a contract break.

#### POST /api/sell/start-auth

Begin the provider OAuth handshake. The response carries the URL the frontend must navigate the browser to. The opaque `state` token is the CSRF / flow-continuity parameter — the frontend stores it (e.g. in `sessionStorage`) and passes it back unchanged to the callback endpoint.

Request:

```json
{ "provider": "eventim_il" }
```

Response 200:

```json
{
  "authUrl": "https://safe-ticket-backend-production.up.railway.app/api/sell/mock-provider/authorize?state=<opaque>",
  "state": "<opaque>"
}
```

In Phase 3, `authUrl` points at the backend's mock-provider route (see below). In Phase 5, it points at the real provider's authorization endpoint. The frontend treats both identically: navigate the browser to `authUrl`.

Errors: `400 invalid_request` (unknown provider slug, missing field), `401 unauthorized`.

#### GET /api/sell/mock-provider/authorize

**Mock-only, Phase 3 scaffolding.** Not present once real connectors ship in Phase 5.

Query: `?state=<opaque>` (echoed from `start-auth`).

Behavior: backend immediately 302-redirects to `${FRONTEND_URL}/sell/callback?provider=<slug>&code=<fake>&state=<echo>`. No human interaction; the user's browser bounces straight back to the frontend callback page with a fake authorization code. This exercises the OAuth contract shape without serving a fake provider login UI.

Real provider authorize URLs (Phase 5) will, of course, take the user through an actual provider-side login + consent screen before redirecting back to the same frontend callback URL.

#### POST /api/sell/callback

Complete the OAuth handshake. Called by the frontend after the provider (or the mock) redirects the browser back to the frontend's `/sell/callback` page. Exchanges `code` for a provider access token; stores the token server-side; returns just the identifiers the frontend needs to render the next step.

Request:

```json
{ "provider": "eventim_il", "code": "<from-redirect>", "state": "<from-redirect>" }
```

Response 200:

```json
{ "providerUserId": "<opaque>", "expiresAt": 1777281113 }
```

The actual provider access token is never returned. Subsequent seller endpoints look it up via the Safe Ticket JWT.

Errors: `400 invalid_request`, `400 callback_failed` (state mismatch / expired code / connector exchange failure), `401 unauthorized`.

#### GET /api/sell/tickets

Returns the seller's tickets as known to the provider. Each ticket is pre-populated with event metadata, seat, face value (always provider-supplied, never seller-entered), and an eligibility flag. Tickets with `eligible: false` are returned so the UI can render them disabled with the reason.

Query: `?provider=eventim_il` (required).

Response 200:

```json
{
  "items": [
    {
      "providerTicketId": "mock-tm-001",
      "event": {
        "name": "Maccabi TA vs Hapoel TA",
        "date": "2026-06-15T20:00:00.000Z",
        "venue": "Bloomfield Stadium",
        "city": "Tel Aviv",
        "category": "sports"
      },
      "seat": { "section": "5", "row": "12", "seat": "8" },
      "faceValueAgorot": 22000,
      "eligible": true,
      "ineligibleReason": null
    }
  ]
}
```

`ineligibleReason` is one of `"already_transferred"`, `"event_passed"`, `"non_transferable"`, `"already_listed_on_safe_ticket"`, or `null` when `eligible: true`. The `already_listed_on_safe_ticket` reason is set by the backend (not the connector) when the same `providerTicketId` already has a non-`removed` listing in our DB — prevents double-listing without trusting the connector to know about Safe Ticket state.

Errors: `400 invalid_request` (missing/unknown provider), `401 unauthorized`, `409 no_provider_session` (the seller has not completed `/sell/callback` for this provider, or the stored token has expired and could not be refreshed).

#### POST /api/sell/create-listing

Creates an active listing in one shot. The backend re-runs `verifyOwnership` + `checkTransferEligibility` at the connector; if both pass, inserts the listing row with `status: "active"` and `verifiedAt: <now>`. Face value, seat, and event metadata are taken from the connector's snapshot — the seller does not supply them.

The `serviceFeeAgorot` field on the resulting listing is computed per the standing rule (10% of face value, integer-truncated, never rounded up). The seller payout amount is computed and stored but is not returned in any Phase 3 response — Phase 4 surfaces it.

Request:

```json
{ "provider": "eventim_il", "providerTicketId": "mock-tm-001" }
```

Response 201: a full Listing object (same shape as `GET /api/listings/:id`), with `status: "active"`.

Errors:

- `400 invalid_request` — validation (unknown provider, missing field).
- `401 unauthorized`.
- `409 no_provider_session` — stored token missing/expired.
- `409 ticket_not_eligible` — `verifyOwnership` or `checkTransferEligibility` rejected. `details` carries `{ reason: "already_transferred" | "event_passed" | "non_transferable" | "ownership_mismatch" }`.
- `409 already_listed` — same `(provider, providerTicketId)` already has a non-`removed` listing in our DB.

#### GET /api/sell/my-listings

Returns every listing belonging to the calling seller, regardless of status — `active`, `removed`, and (Phase 4) `reserved` / `sold` / `expired`. Lets the seller see their full history on the seller dashboard.

Response 200:

```json
{
  "items": [
    /* Listing[] — each item is the same Listing shape returned by GET /api/listings/:id,
       except `status` may also be "removed" | "expired" | "reserved" | "sold". */
  ]
}
```

Sorted by `createdAt` descending. No pagination in Phase 3 (a single seller will not approach the threshold where pagination matters; revisit if and when one does).

Errors: `401 unauthorized`.

#### DELETE /api/sell/listings/:id

Soft-deletes a listing the calling user owns. Flips `status` from `active` to `removed`, bumps `updatedAt`. The row is preserved for audit; hard delete is never offered.

Response: `204 No Content`.

Errors:

- `401 unauthorized`.
- `403 forbidden` — the listing exists but belongs to a different seller. (Distinct from `404` deliberately — leaking the existence of another seller's listing is information disclosure.)
- `404 listing_not_found` — no listing with that `id`, or `id` is not a valid UUID (matches `GET /api/listings/:id` semantics).
- `409 cannot_remove` — the listing is in a status that doesn't permit removal. In Phase 3 this triggers for `removed`, `sold`, or `expired`. Phase 4 adds `reserved`.

### Buyer (Phase 4)

- `POST /api/buy/:listingId/initiate`
- `POST /api/buy/:transactionId/pay`
- `GET /api/buy/my-purchases`

### Transactions (Phase 4)

- `GET /api/transactions/:id`
- `GET /api/transactions/:id/timeline`

---

Note: Endpoints will be detailed with request/response schemas as they are built.
