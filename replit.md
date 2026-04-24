# Mount

A full-stack Agile project management tool for **team collaboration** (3-10 person teams). Members share projects, assign user stories, post progress updates, and flag blockers — all visible in a real-time activity feed. The dashboard also includes a **Team Profiles** panel showing each teammate's count of fully-completed projects (a teammate is counted on a project once it is 100% DONE and they were either the creator or assigned to a story in it).

## Stack

- **Client:** React 19 + Vite + TypeScript + react-router-dom + axios
- **Server:** Express 5 + TypeScript + Prisma 7 (better-sqlite3) + JWT + bcryptjs
- **Database:** SQLite (`server/dev.db`)

## Project Structure

```
.
├── client/                    # Vite React frontend (port 5000, webview)
│   └── src/
│       ├── api.ts             # axios instance with JWT interceptor + auto-logout on 401/403
│       ├── context/AuthContext.tsx
│       └── components/
│           ├── Login.tsx, Register.tsx, ProtectedRoute.tsx
│           ├── Dashboard.tsx       # cross-team project overview
│           ├── Teams.tsx           # list/create/join teams
│           ├── TeamDetail.tsx      # invite code, members, projects
│           └── ProjectDetail.tsx   # kanban + assignees + activity feed + post-update modal
└── server/                    # Express API (port 8000, console)
    ├── prisma/                # schema + migrations
    └── src/
        ├── index.ts           # mounts routes, daily report cron
        ├── prisma.ts
        ├── middleware/auth.ts
        └── routes/
            ├── auth.ts        # POST /register (auto-creates personal team), /login, GET /me
            ├── teams.ts       # CRUD, join via invite code, member management (max 10)
            ├── projects.ts    # team-scoped, plus /:id/activity feed
            ├── stories.ts     # CRUD with optional assignee
            ├── tasks.ts       # CRUD subtasks
            └── updates.ts     # PROGRESS / BLOCKER / NOTE posts on stories
```

## How it runs

Single workflow `Start application` runs `npm start` (uses `concurrently`):
- Express on `:8000`
- Vite on `:5000` with `/api` proxied to Express

The Replit preview shows port 5000. Frontend uses relative `/api` URLs.

## Auth flow

- `POST /api/auth/register` and `/login` return `{ token, user }`. JWT signed with `JWT_SECRET`.
- New users automatically get a personal team (`"<name>'s Team"`) with a random 8-char invite code.
- `AuthContext` persists token+user in `localStorage`. Axios attaches `Authorization: Bearer <token>`. On 401/403 the client clears the session and redirects to `/login`.

## Team collaboration

- **Teams** have an owner, up to 10 members, and a unique invite code (regenerable by the owner).
- **Joining:** anyone enters a code on the Teams page to join.
- **Permissions:** any team member can view/edit projects and stories. Only the project creator or team owner can delete a project. Only the team owner can remove members or delete the team.
- **Stories** can be assigned to any team member.
- **Updates** of three types posted on stories:
  - `PROGRESS` (with 0-100% slider) — auto-bumps story to `IN_PROGRESS` (or `DONE` at 100%).
  - `BLOCKER` — flagged on the story and surfaced at the top of the project until resolved.
  - `NOTE` — free-form share.
- **Activity feed** in `/project/:id` shows the most recent 30 updates from all teammates with avatars and timestamps.

## Environment variables

- `JWT_SECRET` — change this in production (currently falls back to a dev value)
- `DATABASE_URL` — `file:./dev.db`

## Common gotchas

- If the SQLite native binding throws `invalid ELF header`, run `cd server && npm rebuild better-sqlite3`.
- After changing the Prisma schema, run `cd server && DATABASE_URL="file:./dev.db" npx prisma migrate dev` then `npx prisma generate`. The Prisma config doesn't auto-load `.env`.
- Express 5 types `req.params.id` as `string | string[]` — wrap with `String(...)` when passing to Prisma.
