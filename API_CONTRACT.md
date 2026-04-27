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

- `GET /api/listings?q=&eventType=&city=&date=&provider=&page=&limit=`
- `GET /api/listings/:id`

### User Profile (Phase 2)

- `GET /api/users/me/profile`
- `PUT /api/users/me/profile`

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
