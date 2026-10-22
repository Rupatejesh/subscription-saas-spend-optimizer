# API Audit — Phase 13D Current Inventory

Audit date: 2026-10-07. Inventory is based on Express route registration. A distinct method + path is counted once; `/api/v1/health` is excluded. The repository exposes **57 business endpoints**. All 57 success paths were executed against an isolated local MongoDB database; actual HTTP success statuses are recorded in the final column. Negative cases are summarized in `API_TEST_REPORT.md`.

All business routes are prefixed by `/api/v1`. Responses use `{ success, message?, data? }` or `{ success: false, message, details? }`. Statuses in the final column are actual success statuses returned in the isolated integration run. Errors use safe API messages; negative statuses are recorded in `API_TEST_REPORT.md`.

| API ID | Method | Endpoint | Module | Auth | Role | Purpose | DB | Test | Actual status |
|---|---|---|---|---|---|---|---|---|---|
| API-001 | POST | `/auth/register` | Auth | No | Public | Register; body `name,email,password` (2â€“80 chars, valid email, password 12â€“128); duplicate email 409; bcrypt; User; returns public user; 201 | User | PASS | 201 |
| API-002 | POST | `/auth/login` | Auth | No | Public | Login; body `email,password`; validates input, generic credential failure 401; User lookup + bcrypt; sets HttpOnly session cookie; returns public user | User | PASS | 200 |
| API-003 | POST | `/auth/logout` | Auth cookie | Signed-in user | Revoke session version and clear cookie; User update; 200 | User | PASS | 200 |
| API-004 | GET | `/auth/me` | Auth | Auth cookie | Signed-in user | Return current public user; no body or params | User | PASS | 200 |
| API-005 | PUT | `/users/me` | Profile | Auth cookie | Signed-in user | Body `name` (2â€“80 chars); update own profile; 200 | User | PASS | 200 |
| API-006 | PATCH | `/users/me/password` | Profile | Auth cookie | Signed-in user | Body `currentPassword,newPassword,confirmPassword`; validates length/match, verifies current hash, increments session version; 200 | User | PASS | 200 |
| API-007 | GET | `/users/subscriptions/categories` | Subscription management | Auth cookie | Signed-in user | Return supported catalog categories; 200 | None | PASS | 200 |
| API-008 | GET | `/users/subscriptions/summary` | Subscription management | Auth cookie | Signed-in user | Own monthly/annual spend, counts, savings, health and renewal summary; 200 | Subscription | PASS | 200 |
| API-009 | GET | `/users/subscriptions/renewals/upcoming` | Subscription management | Auth cookie | Signed-in user | Own renewals; query `days` (clamped 1â€“90); 200 | Subscription | PASS | 200 |
| API-010 | POST | `/users/subscriptions/:id/usage` | Usage tracking | Auth cookie | Signed-in user | Validate subscription ObjectId; record own usage; 200/404 | Subscription | PASS | 200 |
| API-011 | GET | `/users/subscriptions` | Subscription management | Auth cookie | Signed-in user | Own plans; query `q,category,status,sort,order`; validator; 200 | Subscription | PASS | 200 |
| API-012 | POST | `/users/subscriptions` | Subscription management | Auth cookie | Signed-in user | Create own plan; validates subscription fields; ignores submitted owner/team flags; 201 | Subscription | PASS | 201 |
| API-013 | GET | `/users/subscriptions/:id` | Subscription management | Auth cookie | Signed-in user | Read own plan; ObjectId validation; 404 for non-owned/missing | Subscription | PASS | 200 |
| API-014 | PATCH | `/users/subscriptions/:id` | Subscription management | Auth cookie | Signed-in user | Update own plan; ObjectId + partial-field validation; 404 for non-owned/missing | Subscription | PASS | 200 |
| API-015 | DELETE | `/users/subscriptions/:id` | Subscription management | Auth cookie | Signed-in user | Delete own plan; ObjectId validation; 404 for non-owned/missing | Subscription | PASS | 200 |
| API-016 | PATCH | `/users/:userId/role` | Platform administration | Auth cookie | PLATFORM_ADMIN | Body `role` in known role enum; cannot change own role; increments target session version; 200/400/404 | User | PASS | 200 |
| API-017 | GET | `/teams` | Team/shared | Auth cookie | Signed-in user | List only teams containing caller; 200 | Team | PASS | 200 |
| API-018 | POST | `/teams` | Team/shared | Auth cookie | Signed-in user | Body `name,description?,currency?`; creates owner membership; promotes USER to TEAM_ADMIN; 201 | Team, User | PASS | 201 |
| API-019 | GET | `/teams/invitations/me` | Team/shared | Auth cookie | Signed-in user | List pending invitations for caller email; 200 | TeamInvitation, Team | PASS | 200 |
| API-020 | POST | `/teams/invitations/:invitationId/accept` | Team/shared | Auth cookie | Invited email | Accept only a pending invite for caller's email; 200/403/404/409 | TeamInvitation, Team | PASS | 200 |
| API-021 | GET | `/teams/:teamId` | Team/shared | Auth cookie | Team member | Read team after membership check; 200/403/404 | Team | PASS | 200 |
| API-022 | PATCH | `/teams/:teamId` | Team/shared | Auth cookie | Team OWNER/ADMIN | Update name/description/currency after membership + manager checks; 200 | Team | PASS | 200 |
| API-023 | GET | `/teams/:teamId/dashboard` | Team/shared | Auth cookie | Team member | Shared spend, membership, invitations and usage dashboard; 200 | Team, Subscription, User, TeamInvitation | PASS | 200 |
| API-024 | GET | `/teams/:teamId/alerts` | Alerts | Auth cookie | Team member | Derived renewal/low-use/spend alerts; no stored notification state; 200 | Team, Subscription | PASS | 200 |
| API-025 | GET | `/teams/:teamId/reports` | Reporting | Auth cookie | Team member | Derived team spend, usage, savings, renewals and forecast; 200 | Team, Subscription | PASS | 200 |
| API-026 | POST | `/teams/:teamId/invitations` | Team/shared | Auth cookie | Team OWNER/ADMIN | Body `email,role`; validates role/email and duplicate invite/member; creates pending invite; 201 | Team, TeamInvitation | PASS | 201 |
| API-027 | PATCH | `/teams/:teamId/members/:memberId` | Team/shared | Auth cookie | Team OWNER/ADMIN | Body `role` ADMIN/MEMBER; owner cannot be reassigned; 200 | Team | PASS | 200 |
| API-028 | DELETE | `/teams/:teamId/members/:memberId` | Team/shared | Auth cookie | Team OWNER/ADMIN | Remove non-owner, cannot remove self; 200 | Team | PASS | 200 |
| API-029 | POST | `/teams/:teamId/subscriptions` | Team/shared | Auth cookie | Team OWNER/ADMIN | Body shared plan fields; validates name/amount/cycle/date; creates team-owned plan; 201 | Team, Subscription | PASS | 201 |
| API-030 | POST | `/teams/:teamId/subscriptions/:subscriptionId/usage` | Usage tracking | Auth cookie | Team member | Record caller's usage on active shared plan; 200/403/404 | Team, Subscription | PASS | 200 |
| API-031 | PATCH | `/teams/:teamId/subscriptions/:subscriptionId` | Team/shared | Auth cookie | Team OWNER/ADMIN | Update allowed shared-plan fields; membership/manager check; 200 | Team, Subscription | PASS | 200 |
| API-032 | DELETE | `/teams/:teamId/subscriptions/:subscriptionId` | Team/shared | Auth cookie | Team OWNER/ADMIN | Delete shared plan in specified team; 200/404 | Team, Subscription | PASS | 200 |
| API-033 | GET | `/bank-feed/transactions` | Simulated bank feed | Auth cookie | Signed-in user | Own simulated transactions; query `q,category,recurring,from,to,sort`; 200 | Transaction | PASS | 200 |
| API-034 | GET | `/bank-feed/intelligence` | Subscription detection | Auth cookie | Signed-in user | Detect recurring patterns and derive usage from caller's transaction/plans; labels simulated source; 200 | Transaction, Subscription | PASS | 200 |
| API-035 | POST | `/bank-feed/transactions/generate` | Simulated bank feed | Auth cookie | Signed-in user | Generate mock transactions for caller; 201 | Transaction | PASS | 201 |
| API-036 | POST | `/bank-feed/transactions/import` | Simulated bank feed | Auth cookie | Signed-in user | Body `csv` up to 50 KB; 1â€“100 rows; parse and save simulated rows; 201/400 | Transaction | PASS | 201 |
| API-037 | PATCH | `/bank-feed/transactions/:id/category` | Simulated bank feed | Auth cookie | Signed-in user | Body valid `category`; updates caller-owned transaction; 200/404 | Transaction | PASS | 200 |
| API-038 | GET | `/users/me/alerts` | Alerts | Auth cookie | Signed-in user | Derive renewal/unused/savings/demo-reference alerts from own subscriptions; 200 | Subscription | PASS | 200 |
| API-039 | GET | `/users/me/reports` | Forecasting & reporting | Auth cookie | Signed-in user | Derived spend, categories, usage, savings, renewals and six-month forecast; 200 | Subscription | PASS | 200 |
| API-040 | GET | `/users/me/benchmarks` | Benchmarking | Auth cookie | Signed-in user | Compare own INR category totals with fixed simulated aggregates; no peer records exposed; 200 | Subscription | PASS | 200 |
| API-041 | GET | `/admin/users` | Platform administration | Auth cookie | PLATFORM_ADMIN | Paginated public user list; query `page,limit` (limit 1â€“100); 200 | User | PASS | 200 |

| API-042 | GET | `/users/me/trial` | Application trial | Auth cookie | Signed-in user | Read own simulated 30-day trial status, dates, days remaining, and no-payment label; User | PASS | 200 |
| API-043 | POST | `/users/me/trial/start` | Application trial | Auth cookie | Signed-in user | Start a one-time simulated 30-day trial for an account without a prior trial; User | PASS | 201 |
| API-044 | GET | `/users/me/notifications` | Notifications | Auth cookie | Signed-in user | Generate eligible deduplicated renewal/unused/savings/spending/trial reminders and list own notifications; optional `unreadOnly=true`; User, Subscription, Notification | PASS | 200 |
| API-045 | GET | `/users/me/notifications/unread-count` | Notifications | Auth cookie | Signed-in user | Count own unread persistent notifications; Notification | PASS | 200 |
| API-046 | PATCH | `/users/me/notifications/:notificationId/read` | Notifications | Auth cookie | Signed-in user | Mark own notification read; validates ID and ownership; Notification | PASS | 200 |
| API-047 | POST | `/users/me/notifications/read-all` | Notifications | Auth cookie | Signed-in user | Mark all own unread notifications read; Notification | PASS | 200 |
| API-048 | GET | `/users/me/notification-preferences` | Notifications | Auth cookie | Signed-in user | Read own renewal/unused/savings/spending/team/trial preferences; User | PASS | 200 |
| API-049 | PUT | `/users/me/notification-preferences` | Notifications | Auth cookie | Signed-in user | Body `{preferences:{...}}`; validates known boolean keys and persists partial updates; User | PASS | 200 |
| API-050 | POST | `/users/subscriptions/:id/cancellation-requests` | Cancellation | Auth cookie | Subscription owner | Body `{reason,notes?}`; validates, rejects duplicate active requests, updates in-app status and records audit/notification; CancellationRequest, Subscription, AuditEvent, Notification | PASS | 201 |
| API-051 | GET | `/users/cancellation-requests` | Cancellation | Auth cookie | Signed-in user | List own history; optional `subscriptionId`; validates ID and ownership; CancellationRequest | PASS | 200 |
| API-052 | POST | `/users/cancellation-requests/:requestId/complete` | Cancellation | Auth cookie | Request owner | Mark pending request complete in this app and set plan CANCELLED; no provider call; CancellationRequest, Subscription, AuditEvent, Notification | PASS | 200 |
| API-053 | POST | `/users/cancellation-requests/:requestId/restore` | Cancellation | Auth cookie | Request owner | Restore pending/completed request and reactivate personal plan; CancellationRequest, Subscription, AuditEvent | PASS | 200 |
| API-054 | POST | `/users/demo-workspace` | Demo workspace | Auth cookie | Signed-in user | Explicitly load 12 labelled simulated plans and 36 simulated charges; rejects duplicate load; Subscription, Transaction | PASS | 201 |
| API-055 | DELETE | `/users/demo-workspace` | Demo workspace | Auth cookie | Signed-in user | Remove only caller's `isDemoData` plans/transactions; 404 if none; Subscription, Transaction | PASS | 200 |
| API-056 | GET | `/admin/metrics` | Platform administration | Auth cookie | PLATFORM_ADMIN | Aggregate user/trial/team/plan metrics, simulated spend, DB status and safe audit activity; User, Team, Subscription, AuditEvent | PASS | 200 |
| API-057 | GET | `/admin/teams` | Platform administration | Auth cookie | PLATFORM_ADMIN | List team names, member counts, shared-plan counts and simulated monthly spend; no arbitrary user data; Team, Subscription | PASS | 200 |

## Module totals

These are unique endpoint assignments; no endpoint is counted twice. Team alert/report routes are assigned to their respective modules. Account, profile and subscription CRUD routes account for the remainder.

| Module | Present | Requested | Notes |
|---|---:|---:|---|
| Simulated bank feed | 4 | 6 | Retrieval, generated demo data, CSV import, categorization; no separate sync-status endpoint. |
| Subscription detection | 1 | 5 | One intelligence endpoint; subscription CRUD is counted under subscription management. |
| Usage tracking | 2 | 5 | Personal and team usage write endpoints; integration status is not implemented. |
| Cancellation workflow | 4 | 5 | Personal in-app review/history/complete/restore; no team cancellation or provider integration. |
| Spend forecasting | 1 | 5 | Forecast is part of the personal report response. |
| Team/shared management | 14 | 6 | Team CRUD, membership, invitations and shared plan operations. |
| Alerts/notifications | 8 | 5 | Derived team alerts plus persistent personal notifications, unread state, read actions, and preferences. |
| Reporting dashboard | 2 | 5 | Personal and team report endpoints. |
| Platform administration | 4 | 5 | User list/role update, aggregate metrics/audit activity, and team overview; no configuration or catalog management API. |
| Benchmarking | 1 | 6 | One category comparison response using fixed demo aggregates. |
| Auth/profile/subscription management | 12 | â€” | Register/login/logout/session, profile/password and subscription catalog/CRUD/summaries. |
| Application trial | 2 | — | One-time start and own status/expiry read; simulated, no payment processing. |
| Demo workspace | 2 | — | Explicit load/remove of only tagged sample plans and transactions. |
| **Distinct business endpoints** | **57** | **53** | Health-check excluded; 16 new endpoints represent persisted product behavior. |

## Audit observations

- Cancellation is an in-app workflow only. Do not imply an external subscription is cancelled.
- Personal notifications are persistent; renewal/unused/savings/spending/trial reminders are generated idempotently when the list is read. Shared-plan changes create team notifications; team renewal/usage alerts remain derived.
- Trial is an application/demo trial, starts on registration, and never charges. Login does not reset it.
- Demo workspace data is opt-in and tagged `isDemoData`; its removal leaves personal records untouched.
- Bank feed routes label records as demo/simulated. There is no real bank connection.
- Role middleware protects `/admin/*` and role changes. Team controllers additionally enforce membership and OWNER/ADMIN checks where mutation requires them.
- Personal subscription/transaction queries scope documents to the authenticated user. Team report/dashboard queries first check membership.
- Auth uses bcrypt password hashes, JWT in an HttpOnly cookie, session-version invalidation, login/registration rate limits, CORS credentials and Helmet.
- Preferences and read state are user-scoped; cancellation and role changes generate safe audit events without credentials.
- Gaps found: bank-feed query/body validation is mostly controller-local; imported CSV parsing is a simple comma split (quoted CSV fields are not supported); team/user route ObjectIds now receive explicit validation; team shared-subscription PATCH copies fields then relies on Mongoose save validation; admin APIs are sparse.
- `server/src/api.database.integration.test.js` exercises all 57 business routes against a disposable database whose name ends in `_phase13b_test`. Without an explicit `TEST_MONGODB_URI`, it only derives that database name when the configured MongoDB host is loopback. It drops only that test database before and after the run.
- `server/src/app.integration.test.js` checks malformed registration/login input, missing sessions, platform-admin route protection, and invalid session tokens over HTTP without MongoDB writes.
- `.env` is ignored by `.gitignore`; `.env.example` is tracked as a template. Do not put credentials in audit output.
