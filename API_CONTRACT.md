# Safe Ticket — API Contract
Shared between frontend and backend repos. Keep in sync.

## Base URL
- Local: http://localhost:3001/api
- Production: TBD (Railway URL)

## Auth
All protected endpoints require: Authorization: Bearer <supabase_jwt_token>

## Endpoints

### Health
GET /api/health → { status: "ok" }

### Auth (Phase 2)
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/me

### Search (Phase 2)
GET /api/listings?q=&eventType=&city=&date=&provider=&page=&limit=
GET /api/listings/:id

### User Profile (Phase 2)
GET  /api/users/me/profile
PUT  /api/users/me/profile

### Seller (Phase 3)
POST /api/sell/start-auth
GET  /api/sell/tickets
POST /api/sell/create-listing
GET  /api/sell/my-listings
DELETE /api/sell/listings/:id

### Buyer (Phase 4)
POST /api/buy/:listingId/initiate
POST /api/buy/:transactionId/pay
GET  /api/buy/my-purchases

### Transactions (Phase 4)
GET /api/transactions/:id
GET /api/transactions/:id/timeline

---
Note: Endpoints will be detailed with request/response schemas as they are built.
