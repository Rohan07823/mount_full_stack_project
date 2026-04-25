# What I'd Improve or Build Next

If I had another week or two on Mount, this is roughly the order I'd tackle things. Some of it is paying down debt I knowingly took on; some is real new functionality.

---

## First, the security and ops debt

These come before any new feature work. Most are small.

1. **Move JWT to an httpOnly cookie + add CSRF protection.** Single biggest security improvement.
2. **Refuse to boot without `JWT_SECRET`.** No more dev fallback in production.
3. **Rate-limit `/auth/login` and `/auth/register`.** `express-rate-limit`, 10 minutes of work.
4. **Add `helmet` and a sensible CSP.**
5. **Structured logging with `pino`.** Scrub request bodies from error logs.
6. **Bcrypt rounds bumped to 12** in production (10 is fine for dev).
7. **Refresh-token flow** so users aren't kicked out at the 24h mark.
8. **Soft-delete on `Team` and `Project`** with an admin restore path. Cascade hard deletes are too aggressive for real customer data.

---

## Real-time activity feed

Right now the feed re-fetches on navigation and on actions. With three teammates working on the same project, the lag between someone posting an update and you seeing it is the most obvious "this could feel better" moment.

- Add a `GET /api/projects/:id/activity/stream` endpoint that returns Server-Sent Events.
- Have the project page subscribe to it and prepend new updates to the feed in place.
- Add a tiny "X new updates" pill at the top so the user can choose when to scroll.

SSE specifically (not websockets) because it's one-way, simpler to operate, and survives any reasonable HTTP proxy.

---

## Notifications

Email or in-app:

- A daily digest: "here's what your team did yesterday."
- Mention notifications: `@alice please look at this` in an update message → Alice gets a notification.
- Blocker alerts to the team owner.

There's a placeholder cron in `server/src/index.ts` for the daily digest; the only real work is plugging in a mail provider (Postmark or Resend would be the easy picks).

---

## Better permissions

The current model is "team member can do almost anything". That's the right call for a small team but breaks down past about 15 people. I'd add:

- A **viewer** role that can read but not write.
- A **guest** role that can only see specific projects, not the whole team.
- Project-level overrides so you can lock down a sensitive project even within an open team.

Implementing this without making the codebase miserable means a small `can(user, action, resource)` helper rather than scattering role checks everywhere.

---

## Story improvements

Stories today are just title + description + status + assignee. Reasonable next additions:

- **Subtasks already exist as `Task`** but the UI doesn't expose them well — surface them as a checklist on the story detail.
- **Story points / estimate** field for sprint planning.
- **Due dates** with a calendar view.
- **Labels / tags** with filtering.
- **Attachments** (would need a real storage backend — S3 or similar).
- **Comments separate from updates** — right now `NOTE` updates are the de facto comment thread, which works but conflates two things.

---

## Sprint / iteration concept

Mount currently has projects and stories but no concept of a sprint. For an Agile tool that's a real gap. I'd add:

- A `Sprint` model belonging to a project, with start/end dates.
- Stories can be assigned to a sprint (or live in the backlog).
- A burndown chart on the sprint view.
- A "this week" filter on the dashboard.

---

## Search

Past 20 projects the dashboard becomes a wall of cards. A simple `?` keyboard shortcut that opens a search palette ("jump to project / story / member") would carry a lot of weight.

For implementation, I'd start with client-side filtering against the existing `/api/projects` payload (since it's already on the wire) and only move to a server-side search endpoint if that ever got slow.

---

## Onboarding

The first-run experience is "you signed up, here's an empty personal team". I'd add:

- A short welcome card with three suggested first actions.
- A sample project that gets created (and can be dismissed) for new accounts so the empty state isn't quite so empty.
- An invite-by-email flow as an alternative to invite codes.

---

## Tests

There aren't any yet, which is the most honest thing I can say in this section. Priority order:

1. **Unit tests for the permissions helpers.** `ensureMember`, `canAccessStory`, `canAccessProject`. They're the security floor of the whole app and they're also small functions that are easy to test.
2. **Route-level tests** with a real SQLite test DB. Express + supertest is the obvious choice.
3. **Frontend tests** with React Testing Library focused on the auth flow and the dashboard.
4. **Playwright** for one or two end-to-end smoke flows: register → create project → post an update → see it in the feed.

I'd want CI running these on every push.

---

## Production deployment

Mount is wired for `npm run dev`, not for `node dist/index.js`. To deploy I'd:

- Run `tsc` for the server, ship plain JS, drop `ts-node` from the prod path.
- Build the client into `client/dist` and serve it from the same Express process under `/`. This collapses the two-port setup into one.
- Move from SQLite to Postgres for a real deployment (one schema line + new migrations).
- Health-check endpoint at `/healthz`.
- Dockerfile, eventually.

---

## Smaller polish

The UI is functional but plain. With more time I'd:

- Add a tiny **avatar color hash** so each member's initials chip has a consistent unique colour.
- Add **keyboard shortcuts** for "new story", "new update", "search".
- **Drag-and-drop** to move stories between TODO / IN_PROGRESS / DONE columns.
- An empty-state illustration on the dashboard for first-time users.
- A **dark/light toggle** (right now it's dark only).

None of these are essential. They're the kind of thing that takes the app from "works fine" to "I'd actually want to use this".
