# Phase 13D API Test Report

Date: 2026-10-07

## Phase 13D current results

## Results

| Measure | Result |
|---|---:|
| Distinct business APIs inventoried | 57 |
| API success paths passed | 57 |
| API success paths failed | 0 |
| API success paths fixed during verification | 3 validation gaps |
| API success paths blocked | 0 |
| New APIs added in Phase 13D | 16 |
| 53+ target | ACHIEVED (57 distinct APIs) |

All 57 distinct business routes were executed against a dedicated local MongoDB database with the actual Express app. The integration test asserts actual success status and response envelope for each route, then verifies writes, state transitions, deletion, uniqueness and ownership in MongoDB. `/api/v1/health` is excluded from the count. Detailed route inventory and actual success statuses are in `API_AUDIT.md`.

## Infrastructure and first blocker

- The project already separates Express configuration (`server/src/app.js`) from listening/database startup (`server/src/server.js`); no architecture rename was needed.
- `npm start` connected to MongoDB, then failed with `EADDRINUSE` on port 5000 because a process was already listening there. The existing listener returned a healthy response and reported its database connected. This was a duplicate-start conflict, not a MongoDB connection failure.
- The reason the prior audit left all APIs blocked was the lack of a database-backed integration suite and safe isolated database configuration. That has been addressed with `server/src/api.database.integration.test.js`.
- The integration suite uses an explicit `TEST_MONGODB_URI` if provided, but requires its host to be loopback and its database name to end in `_phase13b_test`. Otherwise, it derives that database name only from a loopback `MONGODB_URI`. It refuses non-loopback URIs and drops only the dedicated test database before and after execution. No secret URI is logged.

## Automated checks

- `npm test`: PASS — server 16/16; client 2/2.
- `npm run build`: PASS — Vite production build.
- API success coverage: PASS — all 57 unique business routes executed; actual success codes are recorded in `API_AUDIT.md`.
- Negative HTTP cases: PASS — invalid registration and login (400), duplicate registration (409), wrong credentials (401), invalid JWT (401), unauthenticated private/admin access (401), TEAM_ADMIN denied platform administration (403), regular team member denied shared-plan management (403), non-member denied team access (403), cross-user subscription lookup (404), invalid subscription/transaction IDs (404), invalid team/user IDs (400), self role change rejected (400), and logout invalidates the session (401 on subsequent session read).
- MongoDB: PASS — local connection confirmed; test DB CRUD was exercised for registration, profile/password and role updates, subscription create/update/delete, transaction generation/import/categorization, team/invitation/shared-plan operations, usage tracking, and read/report queries. Test database was dropped after assertions.
- New Phase 13D APIs: PASS — trial state/start/expiry, persistent notifications/preferences, cancellation request/history/complete/restore, opt-in demo load/remove, and platform metrics were exercised against MongoDB.
- New negative cases: PASS — trial cannot reset (409); invalid preferences and malformed IDs rejected (400); duplicate cancellation/demo load rejected (409); cross-user access denied (404); non-admin metrics denied (403); direct cancellation-state edits rejected (400).
- Trial: PASS — registration persists a one-time trial start/end; an unstarted account can start once; expiry uses the stored end date; no payment integration exists.
- Notifications: PASS — preferences and read state persist, renewal/unused/savings/spending/trial reminders are idempotent, team subscription changes notify members, and disabled categories suppress matching new reminders.
- Cancellation: PASS — in-app request and status transitions persist with audit entries; no provider is contacted.
- Demo workspace: PASS — 12 labelled plans and 36 labelled simulated charges load explicitly; duplicate load is rejected; cleanup targets only tagged records for the caller.
- Platform administration: PASS (implemented scope) — platform-only aggregate metrics, safe audit activity, user/role listing, and team overview return without credentials or hashes. Configuration/catalog administration and account deactivation are outside existing models/routes.
- Database outage/error injection: BLOCKED — the suite does not interrupt MongoDB during a request. This is outside the 57 success-path checks and should be verified separately.

## Module totals

Counts are distinct routes assigned once. All 57 existing success paths were exercised; the route inventory identifies still-missing capabilities separately.

| Module | Existing / requested | Passed | Failed | Fixed | Blocked |
|---|---:|---:|---:|---:|---:|
| Simulated bank feed | 4/6 | 4 | 0 | 1 | 0 |
| Subscription detection | 1/5 | 1 | 0 | 0 | 0 |
| Usage tracking | 2/5 | 2 | 0 | 0 | 0 |
| Cancellation workflow | 4/5 | 4 | 0 | 0 | 0 |
| Spend forecasting | 1/5 | 1 | 0 | 0 | 0 |
| Team/shared management | 14/6 | 14 | 0 | 1 | 0 |
| Alerts/notifications | 8/5 | 8 | 0 | 0 | 0 |
| Reporting dashboard | 2/5 | 2 | 0 | 0 | 0 |
| Platform administration | 4/5 | 4 | 0 | 1 | 0 |
| Benchmarking | 1/6 | 1 | 0 | 0 | 0 |
| Auth/profile/subscription management | 12/— | 12 | 0 | 0 | 0 |
| Application trial | 2/— | 2 | 0 | 0 | 0 |
| Demo workspace | 2/— | 2 | 0 | 0 | 0 |
| **Total** | **57** | **57** | **0** | **3 prior validation gaps** | **0** |

## Fixes made during verification

- The integration suite now exercises 57 unique business endpoints against an isolated MongoDB database. Phase 13B validation fixes listed below are prior work carried forward into this report.
- Added reusable ObjectId path validation for team and user-role routes, and explicit transaction ID handling. Malformed IDs now return controlled client errors instead of reaching Mongoose cast failures.
- The suite creates unique test-only users and records; it uses no real user credentials and removes the isolated test database after execution.

## Missing capabilities / remaining limits

The 53+ target is met with 57 distinct meaningful endpoints; no superficial or duplicate APIs were added. Remaining limits include cancellation of team-owned subscriptions, system configuration/catalog administration, live benchmark data, bank-feed sync status, and external cancellation/bank integrations. These are not represented as implemented.

Database outage injection, rate-limit exhaustion, and every error/boundary case for every route remain untested. These limits do not change the PASS status for each tested success path.
