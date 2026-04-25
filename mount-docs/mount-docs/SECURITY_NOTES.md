# Security Notes

A small app still has a security model. Here's the one I built and the things I'm aware of but didn't fix in the time I had.

---

## What's already in place

### Password storage
Passwords go through `bcryptjs` with a salt round of 10 before they hit the DB. The hash is never returned by any endpoint — `/api/auth/me` selects only `id`, `name`, `email`. The login endpoint returns the same generic `"Invalid credentials"` message whether the email exists or not, so you can't enumerate users by trying random addresses.

### JWT
- HS256, signed with `JWT_SECRET`.
- 1-day expiry. Re-signing on activity isn't implemented; the user just has to log in again the next day.
- The middleware (`server/src/middleware/auth.ts`) verifies the token on every protected request and rejects expired/tampered tokens with 401. The frontend's axios interceptor catches that and clears the session.

### Authorization, on every route
Authentication just proves *who* you are. Authorization proves *what you can do*. Every route that touches a team-scoped resource re-checks team membership before doing anything:

- Reading or editing a project goes through `ensureMember(projectId, userId)` (queries `TeamMember`).
- Reading or editing a story goes through `canAccessStory(storyId, userId)` (joins through the project's team).
- Stricter actions (delete project, remove member, regenerate invite code, delete team) check for either creator or owner role explicitly.

This means even a user holding a valid token can't reach into another team's data by guessing UUIDs.

### Input validation
- Required fields are checked at the top of each handler.
- The `type` field on updates is validated against an explicit allow-list (`PROGRESS`, `BLOCKER`, `NOTE`).
- The `progress` field is range-checked to 0–100 and rounded.
- Invite codes are normalized (`trim().toUpperCase()`) before lookup.

### SQL injection
Prisma's query API parameterizes everything. There is no raw-SQL anywhere in this codebase. Anything that came from `req.body` or `req.params` is wrapped with `String(...)` and handed to Prisma's typed methods.

### Cascade deletes
FK cascade is set explicitly in the schema so we can never end up with orphaned rows that point at users or teams that no longer exist.

### Team size cap
`MAX_TEAM_SIZE = 10` is enforced server-side in the join handler. That isn't really security, it's a product constraint, but it does cap the blast radius of a leaked invite code.

---

## Known gaps and the tradeoffs

These are real, and I'd want to fix them before anyone's actual data hit the system.

### 1. JWT in localStorage
This is the standard XSS-vs-CSRF tradeoff. I went with localStorage for ergonomics (see `DESIGN_DECISIONS.md`). The mitigation here is that the app renders no third-party content and ships no third-party scripts. **For production**, switch to `httpOnly` + `sameSite=lax` cookies and add CSRF tokens on state-changing requests.

### 2. The fallback `JWT_SECRET`
`server/src/routes/auth.ts` uses `process.env.JWT_SECRET || 'super-secret-key-123'`. That dev fallback exists so you can start the app without setting anything up. **In production it must be set**, and ideally the code should refuse to start without it. A two-line change I'd make on day one of a real deployment.

### 3. No rate limiting
Nothing stops someone hammering `/api/auth/login` with a password dictionary. Easy to add `express-rate-limit` (5 attempts per minute per IP per email is a reasonable starting policy). I left it out for simplicity but it's the single most impactful security fix.

### 4. Password policy is loose
The frontend asks for "min 6 characters". The server doesn't even enforce that (it just hashes whatever comes in, as long as the field exists). I'd raise the minimum to 8, add a basic complexity check or — better — integrate `zxcvbn` and reject obviously weak passwords. No "must contain a special character" theatre.

### 5. No account lockout / 2FA
Lockout pairs with rate limiting and would need a real audit trail. 2FA is a bigger lift. Both are roadmap items, not v1.

### 6. CORS is permissive in dev
The server allows the Vite dev origin without restriction. For production I'd lock it to the deployed frontend origin only.

### 7. No security headers
There's no `helmet` middleware applying CSP, X-Frame-Options, Referrer-Policy, etc. That's a one-line install and a config block. Should be added before going public.

### 8. Logging is `console.error`
Every handler catches and logs to stdout. That's fine in a single-process dev app. In production I'd want structured logs (`pino`), and crucially I'd want to make sure the catch blocks don't log full request bodies — somebody's password could land in the logs the day someone accidentally swaps a `404` for a `500` in the wrong place.

### 9. Error messages
The unauthenticated error from the auth route is generic ("Invalid credentials"), which is correct. Some other endpoints leak slightly more than they should — for example, "Team is full" tells an attacker that a given invite code is real even when they couldn't join. That's a small leak. Probably acceptable for this app, but worth knowing about.

### 10. The token is never revocable
Once issued, a JWT is valid until it expires. There's no server-side blacklist or session table. If a user's account is compromised, the only options today are "wait for the token to expire" or "rotate `JWT_SECRET`" (which logs everyone out). For a real app I'd add a tiny `revokedAt` column on `User` and check the JWT's `iat` against it.

### 11. SQLite file is on the same disk
On a single-server deployment this is fine, but the DB file should be backed up. A `litestream` setup pointing at S3 would be the pragmatic answer.

---

## What I would do first if this needed to ship

In order:

1. Move JWT to an httpOnly cookie. Add CSRF protection.
2. Refuse to boot without a real `JWT_SECRET`.
3. Rate-limit `/auth/login` and `/auth/register`.
4. Add `helmet` with a sensible CSP.
5. Tighten the password policy.
6. Add structured logging and scrub bodies from error logs.

Most of those are an afternoon of work each.
