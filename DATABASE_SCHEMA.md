# Database Schema

The DB is SQLite, accessed through Prisma 7 with the `@prisma/adapter-better-sqlite3` adapter. The schema lives at `server/prisma/schema.prisma`. There are seven models. IDs are UUIDs (string `@default(uuid())`) so we don't leak counts and so they're safe to expose in URLs.

For the canonical source see the schema file. This doc is the human version with a bit of "why".

---

## Entity-relationship sketch

```
User ────owns──── Team ────has many────► TeamMember ◄──── User (membership)
 │                  │
 │                  └──── has many ────► Project ──── has many ────► Story
 │                                                                     │
 │                                                                     ├── has many ─► Task
 │                                                                     └── has many ─► Update ──── authored by ──► User
 │
 └── creates Projects, is assigned Stories, posts Updates
```

Cardinality:

- A user **owns** 0..N teams (one team has exactly one owner).
- A user is a **member** of 0..N teams via `TeamMember` (a join row).
- A team has up to 10 members (enforced in app code, not the DB).
- A team has 0..N projects.
- A project has 0..N stories.
- A story has 0..N tasks (subtasks) and 0..N updates.
- An update has exactly one author (a user) and one story.

---

## Models

### User
| Field        | Type     | Notes |
|--------------|----------|-------|
| `id`         | string PK | UUID |
| `email`      | string    | Unique. The login key. |
| `password`   | string    | Bcrypt hash, salt rounds = 10. Never returned by the API. |
| `name`       | string    | Display name. Shown in the UI and used as `"<name>'s Team"` for the personal team. |
| `createdAt`  | DateTime  | |
| `updatedAt`  | DateTime  | |

Relations: `ownedTeams`, `memberships`, `projects` (created), `assignedStories`, `updates`.

### Team
| Field        | Type      | Notes |
|--------------|-----------|-------|
| `id`         | string PK | |
| `name`       | string    | Free-form. |
| `inviteCode` | string    | **Unique.** 8 hex chars, generated with `crypto.randomBytes(4)`. The owner can regenerate it. |
| `ownerId`    | string FK | → `User.id`. Cascade delete (deleting a user nukes their owned teams). |

The owner is also automatically inserted as a `TeamMember` with role `OWNER` at creation time.

### TeamMember (join table)
Tracks which users are in which teams, plus their role.

| Field    | Type      | Notes |
|----------|-----------|-------|
| `id`     | string PK | |
| `teamId` | string FK | Cascade delete |
| `userId` | string FK | Cascade delete |
| `role`   | string    | `OWNER` or `MEMBER`. The DB stores it as a plain string (SQLite has no enum type). |
| `joinedAt` | DateTime | |

`@@unique([teamId, userId])` makes "is this user in this team?" an O(1) lookup and stops accidental duplicates.

### Project
| Field         | Type      | Notes |
|---------------|-----------|-------|
| `id`          | string PK | |
| `name`        | string    | |
| `description` | string?   | Optional. |
| `teamId`      | string FK | Cascade delete. |
| `userId`      | string FK | The creator. Named `userId` rather than `creatorId` because that's what Prisma generates from the `creator` relation field. |

Deleting the creator cascades the project. That's perhaps too aggressive (you'd usually want to reassign rather than delete), but it keeps referential integrity simple in v1. See `WHAT_NEXT.md`.

### Story
| Field        | Type      | Notes |
|--------------|-----------|-------|
| `id`         | string PK | |
| `title`      | string    | |
| `description`| string?   | |
| `status`     | string    | `TODO` (default), `IN_PROGRESS`, `DONE`. Stored as a plain string. |
| `projectId`  | string FK | Cascade delete. |
| `assigneeId` | string FK?| Optional. **`onDelete: SetNull`** — if the assignee leaves and is deleted, the story stays but becomes unassigned. |

### Task
A small checklist item inside a story.

| Field        | Type    | Notes |
|--------------|---------|-------|
| `id`         | string PK | |
| `title`      | string   | |
| `isCompleted`| boolean  | Defaults to false. |
| `storyId`    | string FK| Cascade delete. |

### Update
The unit of the activity feed.

| Field      | Type     | Notes |
|------------|----------|-------|
| `id`       | string PK | |
| `type`     | string    | `PROGRESS`, `BLOCKER`, or `NOTE`. Validated in the route handler. |
| `message`  | string    | |
| `progress` | int?      | Only set for `PROGRESS` updates, validated to be 0–100. |
| `storyId`  | string FK | Cascade delete. |
| `authorId` | string FK | The user who posted it. Cascade delete. |
| `resolved` | boolean   | Only meaningful for `BLOCKER`. Set true via `PUT /api/updates/:id/resolve`. |
| `createdAt`| DateTime  | |

---

## Enum-as-string

SQLite doesn't have native enums and Prisma's `enum` type doesn't translate to SQLite, so role / status / update-type are all stored as strings. The valid values are constrained in application code:

- `TeamMember.role`: `OWNER`, `MEMBER`
- `Story.status`: `TODO`, `IN_PROGRESS`, `DONE`
- `Update.type`: `PROGRESS`, `BLOCKER`, `NOTE`

If the DB were Postgres later on, I'd convert these to real enums.

---

## Migrations

Two of them, applied in order:

1. `20260424040632_init_with_users` — initial users + projects + stories + tasks.
2. `20260424053452_add_teams_and_updates` — added teams, the team-member join table, the updates table, and the assignee link on stories.

Apply with:

```bash
cd server
DATABASE_URL="file:./dev.db" npx prisma migrate deploy
```

For new schema changes during dev, use `migrate dev` instead — it will diff your schema, generate a new migration, and apply it.

---

## Indexes / performance notes

- `User.email` and `Team.inviteCode` are unique, so they're indexed automatically.
- `TeamMember(teamId, userId)` has a composite unique index, which serves the most common access check ("is user X in team Y?").
- The Foreign keys provide enough for current query patterns.
- For a real production version with thousands of stories, I'd add indexes on `Story.projectId`, `Story.assigneeId`, and `Update.storyId`. SQLite would silently use them once added; Prisma supports `@@index([...])`.

---

## Soft vs hard delete

Everything is hard-deleted with cascading FKs. That's simple and correct for a small product, but it means a deleted team is gone — projects, stories, all of it. There's no undo. For an HR-grade production app I'd want a soft-delete pattern, at least on the team and project level. Noted in `WHAT_NEXT.md`.
