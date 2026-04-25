#walk through video link

https://youtu.be/IAEVzb6cjHA?si=QWSwgf1pqho3fid4

#demo link

https://mount-full-stack-project-7.onrender.com/

# Mount — Setup Guide

A small Agile project management tool for teams of 3–10 people. Members share a workspace, create projects, break them into user stories, post progress updates, and call out blockers in a shared activity feed.

This file covers how to get the app running locally. For everything else, see the rest of the docs in this folder.

---

## What's in the box

```
.
├── client/        Vite + React 19 + TypeScript frontend
├── server/        Express 5 + TypeScript + Prisma backend (SQLite)
├── package.json   Root scripts (concurrently runs both)
└── docs/          The reports in this folder
```

The frontend talks to the backend via a relative `/api` path, which Vite proxies during dev. In production you'd serve them under the same origin or set up a real reverse proxy.

---

## Prerequisites

- **Node.js 20+** (I used 20.20)
- **npm 10+** (ships with Node 20)
- That's it — SQLite is bundled via `better-sqlite3`, no separate DB to install.

If you're on a Mac with Apple Silicon or a fresh Linux box, the very first install of `better-sqlite3` will compile a native binding. That can take 30–60 seconds. Don't panic.

---

## First-time setup

From the project root:

```bash
# 1. Install root + client + server deps in one go
npm run install:all

# 2. Generate the Prisma client and create the SQLite file
cd server
DATABASE_URL="file:./dev.db" npx prisma migrate deploy
npx prisma generate
cd ..
```

Why `DATABASE_URL` is set inline: the Prisma config in this project doesn't auto-load `.env`. It picks up the env var from the shell. If you'd rather not type it every time, drop it into your shell profile or use a `.env` file together with `dotenv-cli`.

You should now have `server/dev.db` on disk.

---

## Running the app

From the project root:

```bash
npm start
```

That uses `concurrently` to start two processes:

- Express on `http://localhost:8000`
- Vite on `http://localhost:5000`

Open `http://localhost:5000` in a browser. Sign up with any email + password (min 6 chars). On registration, you automatically get a "personal" team so you can poke around without having to invite anyone first.

If you want to test the team flow properly: register a second account in an incognito window, copy the invite code from the first account's Teams page, paste it into the second account's "Join a team" box.

---

## Environment variables

There are only two and both are optional in development:

| Var            | Default            | Purpose                          |
|----------------|--------------------|----------------------------------|
| `JWT_SECRET`   | `super-secret-key-123` (dev fallback) | Signs JWTs. **Change this in prod.** |
| `DATABASE_URL` | `file:./dev.db`    | Where Prisma stores the SQLite DB |

In production both should be set explicitly. The fallback JWT secret is fine for local development but obviously must not ship.

---

## Useful one-liners

```bash
# Wipe the DB and start fresh (careful — destroys all local data)
rm server/dev.db && cd server && DATABASE_URL="file:./dev.db" npx prisma migrate deploy

# Open Prisma Studio to browse the data in a GUI
cd server && DATABASE_URL="file:./dev.db" npx prisma studio

# Just the backend
npm run start --prefix server

# Just the frontend
npm run dev --prefix client

# Type-check the client
npm run build --prefix client
```

---

## Common problems

**`concurrently: command not found`**
You haven't installed root deps yet. Run `npm install` in the project root.

**`Module '@prisma/client' has no exported member 'PrismaClient'`**
The Prisma client wasn't generated for your platform. Run:

```bash
cd server && DATABASE_URL="file:./dev.db" npx prisma generate
```

**`The table main.User does not exist`**
Migrations haven't been applied to your local DB. Run:

```bash
cd server && DATABASE_URL="file:./dev.db" npx prisma migrate deploy
```

**`invalid ELF header` on `better-sqlite3`**
The native binding was built for a different OS/arch (this happens if you copy `node_modules` between machines). Fix it with:

```bash
cd server && npm rebuild better-sqlite3
```

**Port 5000 or 8000 already in use**
Something else is bound to those ports. Either kill it or change the ports — the client port is in `client/vite.config.ts`, the server port in `server/src/index.ts`.

**The preview can't reach the API**
Check that Vite's `server.proxy` is forwarding `/api` to `http://localhost:8000`. If you changed the backend port, you need to update the proxy too.

---

## Tech stack at a glance

- **Frontend:** React 19, Vite 8, TypeScript, react-router-dom v7, axios
- **Backend:** Express 5, TypeScript, ts-node, jsonwebtoken, bcryptjs
- **ORM/DB:** Prisma 7 + better-sqlite3 (SQLite file)
- **Auth:** JWT (HS256), 1-day expiry
- **Dev tooling:** concurrently, ESLint
