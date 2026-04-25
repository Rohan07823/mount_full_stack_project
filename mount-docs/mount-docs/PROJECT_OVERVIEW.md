# Project Overview & Architecture Notes

## What Mount is

Mount is a lightweight Agile board built around small teams (3–10 people). The goal was to keep the surface area small enough that a teammate could learn it in five minutes, but rich enough to actually be useful for a real sprint:

- A team has members, projects, and an invite code.
- A project has user stories.
- A story can be assigned, has a status (TODO / IN_PROGRESS / DONE), and collects updates from teammates.
- An update is one of three things: a progress check-in (with a 0–100% slider), a blocker, or a free-form note.
- The dashboard shows your projects across all teams plus a "Team Profiles" panel with each teammate's count of completed projects.

Nothing in the app is per-user-private. Once you're in a team, you see everything in that team. That was deliberate (see `DESIGN_DECISIONS.md`).

---

## High-level shape

```
┌────────────────────────┐         HTTP / JSON          ┌───────────────────────┐
│  React 19 + Vite       │  ───────  /api/*  ────────►  │  Express 5 (TS)       │
│  (port 5000, browser)  │  ◄────  JWT in header  ────  │  (port 8000)          │
└──────────┬─────────────┘                              └──────────┬────────────┘
           │                                                       │
           │  AuthContext + axios interceptor                      │  Prisma 7 ORM
           │  (token + user in localStorage)                       ▼
           │                                              ┌─────────────────┐
           │                                              │  SQLite file    │
           │                                              │  server/dev.db  │
           ▼                                              └─────────────────┘
   react-router-dom routes:
     /login, /register
     /            → Dashboard
     /teams       → Teams list
     /team/:id    → Team detail (members, invite code, projects)
     /project/:id → Kanban + activity feed + post-update modal
```

In dev, Vite proxies `/api/*` to the Express server. In a real deployment they'd sit behind one reverse proxy.

---

## Folder layout (the parts that matter)

```
client/src/
  api.ts              axios instance with JWT interceptor and 401/403 auto-logout
  context/AuthContext.tsx
  components/
    Login.tsx, Register.tsx, ProtectedRoute.tsx
    Dashboard.tsx       cross-team project list + Team Profiles panel
    Teams.tsx           list and create/join teams
    TeamDetail.tsx      members, invite code, projects in this team
    ProjectDetail.tsx   kanban board, story details, activity feed, post-update modal

server/src/
  index.ts            wires up routes, CORS, JSON parsing, daily report cron
  prisma.ts           singleton PrismaClient
  middleware/auth.ts  authenticateToken — verifies JWT, attaches req.user
  routes/
    auth.ts      /register, /login, /me  (no JWT required for register/login)
    teams.ts     team CRUD, join via invite code, member management (max 10)
    projects.ts  team-scoped CRUD, plus /:id/activity feed
    stories.ts   CRUD with optional assignee
    tasks.ts     subtasks (checklist items inside a story)
    updates.ts   PROGRESS / BLOCKER / NOTE posts on stories

server/prisma/
  schema.prisma       7 models (see DATABASE_SCHEMA.md)
  migrations/         two migrations: init, then add-teams-and-updates
```

---

## Request lifecycle

1. The user signs in. The server returns `{ token, user }`. AuthContext stashes both in `localStorage` and re-hydrates them on page reload so refreshes don't kick you out.
2. Every API call from the client goes through the shared `axios` instance in `client/src/api.ts`. An interceptor attaches `Authorization: Bearer <token>` automatically.
3. On the server, almost every route is wrapped in `authenticateToken`. The middleware verifies the JWT, looks up the user, and sets `req.user`. The `/auth/register` and `/auth/login` routes are the only ones that skip it.
4. Routes that act on a specific resource always re-check that the calling user is a member of the relevant team before doing anything. Authentication ≠ authorization.
5. If the server ever returns 401 or 403, the axios interceptor on the client clears `localStorage` and bounces you to `/login`. That keeps the UI from showing stale state after a token expires.

---

## How the dashboard's "Team Profiles" works

This was added later. The brief was: under the projects, show each teammate's profile with how many projects they've completed.

The math runs entirely on the client from the data already returned by `GET /api/teams` and `GET /api/projects`:

1. Walk every team I'm in. Collect the union of all members (deduplicated by user id).
2. Walk every project. If the project has at least one story and **every** story has status `DONE`, treat that project as "completed".
3. For each completed project, the contributors are: the project's creator, plus the assignee of any of its stories.
4. Increment each contributor's count by one.

Sorting: by completed count desc, then alphabetically. Each card shows initials, name, the team(s) they share with you, and the count.

I went back and forth on the definition of "completed by user X". The honest options were:
- (a) just "any project I'm in that's 100% done" — but then everyone in a team has the same number, which is boring,
- (b) "projects where I was assigned at least one story" — better,
- (c) "projects where I was assigned at least one story OR I created the project" — best signal of actual involvement.

Went with (c). Counting both creators and assignees feels right: the person who scoped the project did real work, and so did anyone they handed stories to.

---

## Real-time-ish behavior

Mount is **not** a websocket app. The activity feed and dashboard refresh on navigation and on actions you take. That keeps the architecture simple and was a deliberate choice — see `DESIGN_DECISIONS.md` for the reasoning. It would be a small lift to add server-sent events later (the data shape is already there).

---

## Build/runtime

- One root `npm start` runs both processes via `concurrently`.
- `ts-node` runs the TS server directly. No build step in dev. For production you'd want `tsc` + `node dist/index.js` or a bundler like `tsup`.
- Vite handles the client. `npm run build --prefix client` produces a static bundle in `client/dist/`.
- The SQLite file lives at `server/dev.db`. There's no migration runner on boot — you run `prisma migrate deploy` yourself.
