# StockFlow

Inventory control for small teams. A rebuild of the single-file `zeroth_stockflow.html`
prototype as a real server-backed application: hashed authentication, a Postgres ledger,
stock integrity enforced by the database, reorder workflow and CSV import/export.

Live (server build): https://stockflow-kohl-chi.vercel.app — Neon Postgres, shared across
devices and browsers. Sign in with your team account.

## Single-file build

`public/stockflow.html` is a self-contained build for anyone who wants a double-clickable
tool with no server or install. Open it in Chrome, Edge or Firefox and it runs offline.

Live: https://stockflow-html.vercel.app (static deployment of `stockflow-html/index.html`)

- Data lives in that browser's local storage (`stockflow.v1`), so it is per browser profile
  and per device. Download the JSON backup from Settings before clearing browser data.
- Passwords are hashed with PBKDF2-SHA256 (210,000 iterations); sessions last 12 hours.
- Same ledger model, negative-stock guard, weighted-average cost, reorder workflow, CSV
  import/export and owner / manager / viewer roles as the server build.
- Accounts, products and movements are created inside the file on first run — there is no
  seeded password and no network call.

To publish it as a plain static site, copy `public/stockflow.html` to `index.html` in an
empty directory, add `standalone/vercel.json` beside it, then run `vercel --prod`. That is
exactly how https://stockflow-html.vercel.app is deployed.

## What it does

| Area | Behaviour |
| --- | --- |
| **Ledger** | Every change is a movement row (`in`, `out`, `adjust`). Stock on hand is always `SUM(quantity)` — it is derived, never stored, so it cannot drift. |
| **Integrity** | Database `CHECK (quantity <> 0)`, a unique index on `lower(sku)`, and row-level locking on the product inside each transaction. An issue that would take stock negative is rejected and rolled back. |
| **Receiving** | Optional unit cost recalculates a weighted average cost, so stock valuation stays honest. |
| **Stock counts** | Enter the physical count; the ledger stores the difference as an `adjust` movement with a reason. |
| **Reorder** | Products at or below their reorder level are grouped by supplier with a suggested quantity, estimated cost, copy-to-clipboard order text and a pre-filled supplier email. |
| **Reports** | Valuation by category at cost and retail, units received/issued for a date range, top issued products, full audit trail. |
| **CSV** | Export products, movements (filtered) and the reorder list. Import upserts by SKU; opening stock only applies to newly created products, so re-importing never double counts. |
| **Auth** | scrypt password hashing, HttpOnly session cookies (SHA-256 token hashes stored server-side, 30-day expiry), roles `owner` / `manager` / `viewer`. Changing a password signs other devices out. |
| **Workspace** | Name and currency are stored in Postgres and editable by the owner in Settings. INR (₹) is the default; 10 currencies are supported and all money is formatted with the matching locale. |
| **Duplicate submits** | A form guard blocks a double click, and every movement carries a durable `request_id` with a unique index, so a replayed submission never posts twice. |
| **Audit** | `audit_log` records who created, edited, archived, imported or reset what. |

## Stack

- Next.js 14 (App Router, server actions, server components)
- Postgres via `pg` (Neon on Vercel)
- Tailwind CSS
- No ORM: schema is created idempotently on first query, inside an advisory lock

## Local development

Two options. The first needs no installed Postgres:

```bash
npm install
npm run db:local     # starts an embedded Postgres on :55432, leave it running
npm run dev          # in a second terminal
```

`npm run db:local` prints the connection string; add it to `.env.local` as `DATABASE_URL`.
Data is stored in `.pgdata/` and survives restarts. Stop with Ctrl+C.

With your own server, skip `db:local` and set `DATABASE_URL` directly:

```bash
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000. If no account exists, `/signup` creates the owner account; after
that, more users are invited from **Settings → Team**.

### Environment

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | Postgres connection string (`?sslmode=require` for hosted) |
| `POSTGRES_URL` | fallback | Accepted if `DATABASE_URL` is absent (Vercel integrations) |
| `NEXT_PUBLIC_CURRENCY` | no | Starting ISO currency code, default `INR`. The value saved in Settings wins. |
| `NEXT_PUBLIC_ORG_NAME` | no | Starting workspace label, default `Zeroth StockFlow`. Editable in Settings. |

## Tests

```bash
npm test          # unit tests: validation, passwords, CSV, weighted average (16)
npm run test:db   # Postgres ledger tests (6), requires TEST_DATABASE_URL
```

`npm test` needs no database. The database suite uses its own connection string so it can
never touch production:

```bash
# PowerShell
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:55432/stockflow"
npm run test:db
```

It covers receipts, issues, counts, weighted average with a blank cost, two concurrent issues
that cannot oversell, request-id replay, and archived products rejecting movements. The suite
creates its own user and products and removes them afterwards.

## Deployment

```bash
npx vercel link
npx vercel install neon        # marketplace Postgres, injects DATABASE_URL
npx vercel --prod
```

Pull the connection string for local work with `npx vercel env pull .env.local`.

Production runs on Neon Postgres (`neon-aquamarine-island`, project `cold-truth-06704243`).
The tables are created by `ensureSchema()` on the first query, guarded by a Postgres advisory
lock, so no separate migration step is required. The first request after deploying this
version also adds `movements.request_id` (with a unique index) and the `workspace` table; the
DDL is idempotent and safe to run against an existing database.

Beware: `vercel env pull` overwrites `.env.local` with the hosted `DATABASE_URL`. Point
`DATABASE_URL` back at `postgresql://postgres:postgres@localhost:55432/stockflow` if you want
local development to use the embedded database instead of production.

Pushes to GitHub do not deploy yet — the Vercel account has no GitHub login connection, so
deploys are run with `vercel --prod`. To switch to git deployments, link GitHub under
Vercel → Account → Login Connections, then run `vercel git connect`.

## Security notes

- Replace the bootstrap owner account with the real owner before sharing the URL, and use a
  unique password that has never been posted in a chat or issue tracker.
- Passwords are never stored or logged in plain text (the prototype kept them in `localStorage`).
- Session cookies are `HttpOnly`, `SameSite=Lax`, `Secure` in production.
- Every mutating server action calls `requireUser`/`requireWriter`/`requireOwner` before touching data.
- Exports require a session.
- Set a strong password for the owner account — there is no password reset email flow, so keep
  at least two owner accounts if lockout risk matters.
