# Safe Ticket — Backend

## Project
API server for secondary ticket marketplace. Handles auth, listings, search,
transactions, payments, escrow, and provider connectors.

## Tech Stack
- Node.js + Express.js with TypeScript
- Supabase (PostgreSQL for database + Supabase Auth)
- Deployed on Railway (auto-deploy from main branch)

## System Principles
1. Official-only: only verified tickets from supported providers
2. Trust through state: never rely on user declarations
3. Money moves last: no payout before transfer_completed
4. Verifiability over coverage: if provider can't do fast verification, don't support it
5. Provider abstraction: unified connector interface

## File Structure
src/
  routes/        → Express route handlers (auth, search, seller, buyer, transaction)
  services/      → Business logic (listing service, transaction service, escrow service)
  models/        → Type definitions + database query functions
  connectors/    → Provider integrations (mock connector now, real ones later)
  middleware/    → Auth verification, input validation, error handling
  utils/         → Helpers, constants, fee calculations

## Database
Supabase PostgreSQL. 13 entities: User, UserProfile, Provider, Event, Ticket,
Listing, Transaction, PaymentRecord, EscrowRecord, TransferRecord,
Notification, SupportCase, ProviderAuthSession.

Key state machines:
- Listing: draft → verified_ready → active → reserved → sold/removed/expired
- Transaction: initiated → payment_pending → payment_authorized → escrow_held → transfer_pending → transfer_in_progress → transfer_completed → payout_pending → completed
- Transfer: pending → initiated → provider_processing → completed/failed

## Connector Interface
Each provider implemented behind unified abstraction:
startAuth(), listTickets(), verifyOwnership(), checkTransferEligibility(),
initiateTransfer(), getTransferStatus()
Factory: getConnector(providerId)

## Current Sprint
Phase 0, Sprint 0.3 — Project setup. No features built yet.

## API Contract
See API_CONTRACT.md for all endpoints.

## Rules
- All endpoints return JSON
- Auth via Supabase JWT tokens in Authorization header
- Validate all inputs with zod
- Log all state transitions (audit trail)
- Never expose provider auth tokens to clients
- Face value is immutable — cannot be edited by seller
- Escrow funds released ONLY after transfer_completed
- Use row-level locking for listing reservation (prevent race conditions)
- Commit after each working feature with descriptive messages
