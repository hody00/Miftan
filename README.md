# מפתן · Miftan

Hebrew RTL apartment-search foundation. **Milestone 1 only:** Next.js App Router, TypeScript, Supabase SSR email/password and Google authentication, protected dashboard, private PostgreSQL schema and image Storage.

The dashboard now includes private Facebook group and page management. For manual Facebook sign-in on Windows, see [the local companion setup](companion/README.md). Collection remains disabled until the authorization scope and retention cleanup are in place.

## Local setup

Prerequisites: Node.js 22+ (24 recommended), npm, and running Docker Desktop with Linux containers. From this directory:

```powershell
npm ci
npm run db:start
Copy-Item .env.example .env.local
npx supabase status
```

Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` to the local publishable or legacy anon key shown by Supabase. For integration tests only, set `SUPABASE_SERVICE_ROLE_KEY` to the local service-role key. Never use a hosted project or production keys for tests. The app does not use a service-role key.

```powershell
npm run dev
```

Open http://localhost:3000 consistently (do not mix `localhost` and `127.0.0.1` in browser sessions). Supabase API: http://127.0.0.1:54321; Studio: http://127.0.0.1:54323; development email inbox: http://127.0.0.1:54324. Local email is captured rather than sent to real addresses.

Register, open the confirmation message in the development inbox, then follow its link. Password recovery works similarly. Links exchange a one-time token hash server-side and redirect to a clean URL. Expired or replayed links show a Hebrew error. OAuth uses a PKCE code exchange. Redirect destinations are allowlisted; the origin comes from configuration, never request headers.

`npm run db:reset` rebuilds **local** data from migrations and deletes local records. Use only for a disposable development database. `npm run db:stop` stops the stack without intentionally deleting its data.

## Google OAuth

Google is implemented but disabled by default until development OAuth credentials are supplied. The UI keeps the option visible and unavailable instead of initiating a broken flow.

1. Create a Google OAuth web application and configure consent/test users. Add `http://127.0.0.1:54321/auth/v1/callback` as an authorized redirect URI.
2. In `supabase/config.toml`, set `[auth.external.google] enabled = true` and the client ID. Set `SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET` in the shell used to start Supabase, or an ignored `supabase/.env`; never commit the secret.
3. Set `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` in `.env.local`, restart Supabase and Next.js, then test sign-in, cancellation, sign-out and repeat sign-in with a Google test account.

A real Google sign-in is **unverified without OAuth credentials**. Email tests do not verify Google OAuth.

## Checks

```powershell
npm run test
npm run typecheck
npm run build
npm run db:test
npm run test:integration
npx playwright install chromium
npm run test:e2e
```

Unit tests cover credential validation and unsafe redirect destinations. Database tests cover the exact calendar-month cutoff. Integration tests use two disposable local users to exercise RLS, ownership constraints, deduplication, null defaults, expiry and actual private Storage operations. Browser tests cover RTL, keyboard focus, mobile overflow, protected routes, registration, confirmation, login, logout and recovery. Test users and image objects are removed after tests.

## Data and security

- Tables: `sources`, `posts`, `listings`, `listing_images`. Every record belongs to a Supabase user. Composite foreign keys prevent linking to another user's records.
- RLS and private Storage protect reads/writes. The `listing-images` bucket accepts JPEG, PNG and WebP up to 10 MiB; object names start with the owner's UUID and require image metadata.
- Six-calendar-month retention is enforced on reads, including related listings and images. Unknown publication dates are rejected; unknown apartment fields remain null.
- Sources default disabled and a database check prevents enabling them in this milestone. Authorization status is descriptive, not permission to collect.
- Physical retention cleanup and Storage lifecycle cleanup must ship before live collection. SQL cascades alone do not delete image bytes.
- No Facebook passwords, cookies or profiles belong in Supabase, logs, this repository or the Next.js process. No privileged key is shipped to the browser.
- Authentication pages and protected responses are dynamic and private/no-store. Server-side access uses verified Supabase users; logout affects the current device.

See [the future ingestion contract](docs/ingestion-contract.md). Later milestones are source management/local companion, normalization, Hebrew parsing/deduplication, apartment search, then automatic sync and hardening. Production email delivery, abuse controls, account deletion and deployment configuration remain future release work.
