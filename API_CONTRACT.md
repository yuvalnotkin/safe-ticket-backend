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

`details` is present only for `invalid_request` (zod issue list).

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

- `POST /api/sell/start-auth`
- `GET /api/sell/tickets`
- `POST /api/sell/create-listing`
- `GET /api/sell/my-listings`
- `DELETE /api/sell/listings/:id`

### Buyer (Phase 4)

- `POST /api/buy/:listingId/initiate`
- `POST /api/buy/:transactionId/pay`
- `GET /api/buy/my-purchases`

### Transactions (Phase 4)

- `GET /api/transactions/:id`
- `GET /api/transactions/:id/timeline`

---

Note: Endpoints will be detailed with request/response schemas as they are built.
