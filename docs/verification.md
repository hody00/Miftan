# Milestone 1 verification

Verified locally on 2026-11-04 using Node 24, Docker Desktop, local Supabase and Chromium.

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`) | Pass |
| Production build (`npm run build`) | Pass |
| Unit tests (`npm run test`) | 11 passed |
| PostgreSQL calendar-retention tests (`npm run db:test`) | 5 passed |
| Two-user API and Storage tests (`npm run test:integration`) | 6 passed |
| Desktop/mobile browser tests (`npm run test:e2e`) | 4 passed |
| Visual review | Desktop/mobile login and desktop dashboard inspected |
| Google OAuth with a real Google account | Not run: development OAuth credentials required |

Browser tests consume real signup/recovery messages from the local Mailpit inbox, follow their token-hash links, reject login before email verification, and verify the changed password. Tests also verify anonymous redirects, safe callback failure, Hebrew/RTL markup, keyboard focus and mobile page width.

Isolation tests verify database reads/writes/deletes, forged ownership, cross-user foreign keys, per-user deduplication, unknown-field defaults, collection remaining disabled, private image download/signing/overwrite/deletion, and expiry propagation. Test users and Storage objects are cleaned up.

The app is local-only. Collection and physical retention cleanup are intentionally deferred; collection cannot be enabled in the current schema. Browser screenshots are generated under ignored `test-results/` on each E2E run. Dependency installation reported zero known vulnerabilities at the time of installation; this is not a security audit.
