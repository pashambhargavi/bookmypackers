# Prowider — Mini Lead Distribution System

A full-stack Next.js 14 application implementing a fair lead distribution engine with real-time dashboards, concurrency-safe allocation, and idempotent webhook processing.

---

## Tech Stack

- **Frontend/Backend**: Next.js 14 (App Router, API Routes)
- **Database**: PostgreSQL via Prisma ORM
- **Real-time**: Server-Sent Events (SSE)
- **Language**: TypeScript

---

## Local Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (local or hosted — Neon, Supabase, Railway all work)

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd prowider-lead-distribution
npm install
```

### 2. Configure Database

```bash
cp .env.example .env.local
```

Edit `.env.local` and set your `DATABASE_URL`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/prowider_db"
```

### 3. Initialize Database

```bash
# Generate Prisma client + push schema + seed data
npm run setup
```

This runs:
1. `prisma generate` — generates typed client
2. `prisma db push` — creates all tables
3. `node prisma/seed.js` — seeds 3 services, 8 providers, allocation states

### 4. Start Dev Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Home / system overview |
| `/request-service` | Customer lead submission form |
| `/dashboard` | Real-time provider dashboard |
| `/test-tools` | Webhook simulation & concurrency testing |

---

## Deployment (Vercel + Neon)

### Step 1 — Create Neon Database
1. Go to [neon.tech](https://neon.tech) → New Project
2. Copy the connection string (Pooled connection, `?sslmode=require`)

### Step 2 — Deploy to Vercel
```bash
npm install -g vercel
vercel
```

Set environment variable in Vercel dashboard:
```
DATABASE_URL = your_neon_connection_string
```

### Step 3 — Run Migrations on Production
```bash
# After deployment, run once:
DATABASE_URL="your_prod_db_url" npx prisma db push
DATABASE_URL="your_prod_db_url" node prisma/seed.js
```

Or add to Vercel Build Command:
```
prisma generate && prisma db push && node prisma/seed.js && next build
```

---

## Testing Guide

### Manual Tests

**1. Submit a lead:**
- Go to `/request-service`
- Fill in the form, pick any service
- Submit → see confirmation with assigned providers

**2. Duplicate lead prevention:**
- Submit with the same phone + same service → expect 409 error
- Same phone + different service → allowed

**3. Real-time update:**
- Open `/dashboard` in Tab 1
- Submit a lead in Tab 2
- Watch Tab 1 update automatically (providers flash briefly)

**4. Idempotency test:**
- Go to `/test-tools`
- Click "Idempotency Test (3× same ID)" 
- Log should show: 1 processed, 2 blocked as duplicate

**5. Concurrency test:**
- Click "Generate 10 Leads Simultaneously"
- All leads allocate without duplicate assignments or constraint violations

**6. Quota reset via webhook:**
- Click "Webhook → Reset Quota"
- All provider `leadsReceived` resets to 0, quota to 10
- Dashboard reflects immediately via SSE

---

## Allocation Algorithm

### Design

Each service has two pools:

| Service | Mandatory Providers | Round-Robin Pool |
|---------|-------------------|-----------------|
| Service 1 | Provider 1 | Providers 2, 3, 4 |
| Service 2 | Provider 5 | Providers 6, 7, 8 |
| Service 3 | Provider 1, Provider 4 | Providers 2, 3, 5, 6, 7, 8 |

### Steps per lead

1. **Mandatory assignment**: All mandatory providers for the service are assigned first (if quota available)
2. **Round-robin fill**: Remaining slots (up to 3 total) are filled from the pool using a persistent `poolIndex` stored in the `allocation_states` table
3. **Quota check**: Providers at quota (`leadsReceived >= monthlyQuota`) are skipped
4. **Persist state**: The new `poolIndex` is saved back to the database — survives server restarts

### Why this is fair

- The round-robin index is persisted in PostgreSQL, so if Lead 1 took Provider 2 from the pool, Lead 2 starts from Provider 3. This state survives restarts.
- Providers that are quota-full are skipped but the index still advances, so they don't block others.
- Random selection is **never** used.

---

## Concurrency Handling

### Problem
Multiple leads arriving simultaneously could cause:
- Two allocations selecting the same pool provider (double-booking)
- Race condition on `poolIndex` update
- Provider quota exceeded due to simultaneous increments

### Solution: PostgreSQL Serializable Transactions + `SELECT FOR UPDATE`

```typescript
await prisma.$transaction(async (tx) => {
  // Lock the allocation state row for this service
  const allocationState = await tx.$queryRaw`
    SELECT * FROM allocation_states WHERE "serviceId" = ${serviceId}
    FOR UPDATE  -- Row-level lock
  `;
  
  // Lock all candidate providers
  const providers = await tx.$queryRaw`
    SELECT * FROM providers WHERE id = ANY(...)
    FOR UPDATE
  `;
  
  // Safe to read and update — no concurrent transaction can touch these rows
  // ... allocation logic ...
  // ... update poolIndex ...
}, { isolationLevel: 'Serializable' });
```

- `FOR UPDATE` acquires a row-level lock — concurrent transactions wait until the lock is released
- `isolationLevel: 'Serializable'` prevents phantom reads
- Each lead allocation becomes a serial operation even under concurrent load
- The DB unique constraint `@@unique([leadId, providerId])` is the final safety net

---

## Webhook Idempotency

### Problem
Payment gateways may deliver the same event multiple times (retries, network failures). Processing a quota reset twice would be incorrect.

### Solution: EventId deduplication table

```typescript
// Before processing:
const existing = await prisma.webhookEvent.findUnique({ where: { eventId } });
if (existing) {
  return { idempotent: true, processedAt: existing.processedAt }; // Return early
}

// Inside transaction, record the event:
await tx.webhookEvent.create({ data: { eventId, eventType, payload } });
// Then do the actual work...
```

- `WebhookEvent.eventId` has a `@unique` constraint — attempting to insert the same ID twice throws a DB error, providing a second layer of protection
- The table acts as a permanent audit log of all processed events
- Even under concurrent delivery of the same event, only one transaction can insert the eventId; the other will conflict and be returned the "already processed" response

---

## Database Schema

```
services         — 3 rows (Service 1, 2, 3)
providers        — 8 rows with quota tracking
leads            — customer enquiries (unique: phone+serviceId)
lead_assignments — junction table (unique: leadId+providerId)
allocation_states — persistent round-robin state per service
webhook_events   — idempotency log
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
