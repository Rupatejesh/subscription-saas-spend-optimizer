# Project documentation

Architecture and API design notes for the Subscription & SaaS Spend Optimizer belong here.

## API conventions

- Add endpoints only when they support a real user or platform workflow.
- Keep routes versioned under `/api/v1` and separate routing, controllers, validation, and business logic.
- Return JSON using `{ "success": true, "message": "...", "data": ... }` for successful responses and `{ "success": false, "message": "..." }` for errors.
- Document authentication, role access, validation, persistence, and error behavior for each endpoint.
- Label demonstration financial data as mock or simulated. Do not imply a live banking or payment integration unless one exists.

## Authentication and roles

- Registration always creates a `USER`; clients cannot self-assign elevated roles.
- Sessions use a short-lived JWT in an HttpOnly, SameSite=Strict cookie. Passwords are stored as bcrypt hashes. Logout, password changes, and role changes advance the account session version to invalidate existing tokens.
- Backend routes must use `authenticate` and `authorize(...)` middleware for protected operations. Frontend route guards are only a navigation aid.
- Before public registration, use `npm run bootstrap:admin` from `server/` once to create the initial platform admin, with `PLATFORM_ADMIN_EMAIL` and `PLATFORM_ADMIN_PASSWORD` configured in `server/.env`. Remove those bootstrap values after use.
