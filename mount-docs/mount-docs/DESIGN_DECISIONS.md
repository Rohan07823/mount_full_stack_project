# Design Decisions & Tradeoffs

A few of the choices that shaped the codebase, and the things I gave up to get them. I tried to be honest about where I'd do something different on a real product.

---

## SQLite over Postgres

The brief was a small collaboration tool, not a multi-tenant SaaS. SQLite via `better-sqlite3` is in-process, has no setup, and a single file makes the whole project trivial to clone, run, and inspect.

**Tradeoff:** SQLite serializes writes. With 3–10 users on a team that's invisible. With hundreds of concurrent writers it would matter. The Prisma data layer is the same either way, so swapping the provider to `postgresql` would be a one-line schema change plus a fresh set of migrations. Strings instead of enums (see below) would also be easy to convert at that point.

---

## Prisma over a hand-rolled query layer

I was choosing between Prisma, Drizzle, and raw SQL. Prisma won because:

- It generates strongly-typed query helpers, which catches a lot of dumb mistakes at compile time.
- The schema file doubles as documentation.
- Migrations and the studio GUI are nice ergonomics.

What I gave up: Prisma is a bit heavyweight for this size of app, and its newer "client" runtime occasionally surprises you (the `PrismaClient is not exported` error during first run is a typical example — fix is to run `prisma generate`). For a performance-critical service I'd consider Drizzle or kysely; for a CRUD app this is fine.

---

## JWT in localStorage vs httpOnly cookies

JWT in `localStorage` means simpler middleware, easier API testing from `curl`, and no CORS dance. It also means the token is reachable from JS, which is the classic XSS exposure.

For this product I made the call that:

1. There's no third-party script (no analytics, no ad SDK, nothing). The XSS surface is whatever I write myself.
2. The server applies real authorization on every route — even with a stolen token, an attacker can only do what that user can do, scoped to their teams.
3. Tokens expire in 24h.

If this app added an embedded chat widget, a third-party CMS, or any kind of user-generated HTML rendering, I'd move to httpOnly + sameSite=lax cookies and add CSRF protection. Right now, none of that applies.

---

## No real-time / no websockets

It would have been fun to wire up SSE or websockets so the activity feed pushes updates live. I didn't, for two reasons:

- It pulls in extra moving parts (a long-lived connection layer, reconnection logic, presence handling) that's not free to maintain.
- The actual UX gap with "refresh the page" is small for a 5–10 person team that's chatting in Slack anyway.

If I were to add it, I'd start with **Server-Sent Events** for the activity feed only — it's one-way, dead simple over HTTP, and survives any sane proxy.

---

## Auto-create a personal team on registration

When a new user signs up, the server immediately creates a team called `"<name>'s Team"` and makes them the owner. This avoids the cold-start UX where you log in and stare at an empty dashboard wondering what to do.

The downside is one slightly weird-looking team in everyone's list. Worth it.

---

## "Completed projects" definition (Team Profiles)

The dashboard panel shows each teammate with a count. The interesting part was deciding what counts as "completed by user X". Three options I considered:

- **Just count fully-done projects in the user's teams.** Then everyone in the team has the same number — useless.
- **Count projects where the user was assigned at least one story.** Better, but ignores project leads who scope things and hand them out without taking a story.
- **Count projects where the user was assigned a story OR was the creator.** This is what shipped.

Tradeoff: a "creator" who never lifted a finger after creation still gets the credit. For the size of teams this targets, that's fine. For a perf-review tool it would be too generous.

---

## Client-side computation for Team Profiles

The teammate stats are computed in the browser, not by a server endpoint. The data was already on the wire (`/api/projects` and `/api/teams`), so adding a separate `/stats` endpoint would have been weight without benefit at this scale.

If the project list ever grew past a few hundred for a single user, I'd push the aggregation server-side and cache it.

---

## TypeScript everywhere, but ts-node in dev

The server runs through `ts-node`, no build step. That's great for dev iteration. For production I'd compile down with `tsc` and run plain Node — `ts-node` has measurable startup cost and isn't designed to be the runtime. I left a note in the README about this.

A small wrinkle: Express 5 types `req.params.id` as `string | string[]` (because of repeated query params). Every route handler wraps it with `String(...)` before passing to Prisma. Ugly but explicit.

---

## Permissions model: simple, not granular

Three permission rules across the whole app:

1. You can read/write anything in a team you're a member of.
2. Only the project creator OR the team owner can delete a project.
3. Only the team owner can remove members, regenerate the invite code, or delete the team.

That's the entire permissions story. No project-level "viewer" or "guest" roles, no per-story permissions. For a small-team product that wants to feel collaborative rather than locked-down, that's a feature.

For a product that needs RBAC (legal, finance, regulated industries), I'd swap this out for a proper roles + capabilities system. Not in scope here.

---

## Cascade deletes everywhere

Deleting a team cascades to every project, story, task, and update inside it. Deleting a user cascades to their owned teams (and therefore everything in them) and their authored updates.

This is correct for a personal hobby app. It's almost certainly wrong for a product where data has compliance value. For a real production version I'd switch to soft delete on the top-level entities (`Team`, `Project`) and add an admin "restore" path.

---

## Folder layout: by feature, not by layer

Routes, models, and middleware live in clear `routes/`, `prisma/`, `middleware/` folders rather than being grouped by feature. At ~6 routes that's still readable. Past 20 routes I'd flip to a feature-folder layout (`features/projects/{routes,service,types}.ts`).

---

## Things I almost did and dropped

- **A "blocked by" link between stories.** Started designing it, realized I'd also need a graph view to make it useful, and cut it.
- **A daily email digest.** There's a placeholder cron in `server/src/index.ts`. Wiring it up to a real mail provider is straightforward but I didn't want to take a dependency on an external service for a take-home.
- **OAuth login (Google).** Cool, but added a whole signup flow on top of the existing one for marginal benefit at this stage.

These are all reasonable v2 candidates and live in `WHAT_NEXT.md`.
