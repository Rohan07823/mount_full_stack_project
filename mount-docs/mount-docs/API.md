# API Documentation

All endpoints live under the `/api` prefix. The frontend talks to them through a Vite proxy in dev. Requests and responses are JSON unless noted.

**Auth:** Every endpoint except `POST /api/auth/register` and `POST /api/auth/login` requires a header:

```
Authorization: Bearer <jwt>
```

Tokens expire after 1 day. If the server returns 401 or 403 the client clears the session.

**Common error shape:**

```json
{ "error": "human-readable message" }
```

Status codes used: 200, 201, 204, 400, 401, 403, 404, 500.

---

## Auth

### POST /api/auth/register
Create an account. Auto-creates a personal team named `"<name>'s Team"` so the user has somewhere to start.

Body:
```json
{ "name": "Alice", "email": "alice@example.com", "password": "secret123" }
```

Returns `201`:
```json
{
  "token": "eyJ...",
  "user": { "id": "uuid", "name": "Alice", "email": "alice@example.com" }
}
```

Errors: `400` if any field is missing or the email is already taken.

### POST /api/auth/login
Body: `{ "email", "password" }`. Returns the same shape as register on `200`. `400` on bad credentials.

### GET /api/auth/me
Returns the current user from the JWT.
```json
{ "id": "uuid", "name": "Alice", "email": "alice@example.com" }
```

---

## Teams

A team has an owner, up to 10 members, and a unique invite code. The owner can regenerate the code, remove members, or delete the team. Anyone can leave (unless they own it).

### GET /api/teams
List teams the current user belongs to. Each team includes its members and a `_count.projects`.

### GET /api/teams/:id
Single team with members and projects (with each project's stories' status only). 403 if you're not a member.

### POST /api/teams
Body: `{ "name": "Mount Crew" }`. Creator becomes owner.

### POST /api/teams/join
Body: `{ "inviteCode": "AB12CD34" }`. Case-insensitive on the server. Returns `{ id, name }` of the joined team.

Errors: `404` (bad code), `400` ("already a member" or "team is full").

### POST /api/teams/:id/leave
The owner can't leave — they have to delete the team instead.

### DELETE /api/teams/:id/members/:userId
Owner only. Can't remove the owner.

### DELETE /api/teams/:id
Owner only. Cascades to projects, stories, tasks, updates.

### POST /api/teams/:id/regenerate-code
Owner only. Returns `{ "inviteCode": "NEWCODE1" }`.

---

## Projects

Projects are scoped to a team. Any team member can read or update; only the project's creator or the team owner can delete.

### GET /api/projects
Returns every project across every team you belong to. Each project includes:
- `team` (id, name)
- `creator` (id, name)
- `stories` array — currently just `{ status, assigneeId }` (kept light because the dashboard needs both for the "Team Profiles" math)

Ordered by `createdAt` desc.

### GET /api/projects/:id
Full detail: team + members, creator, every story with its tasks, assignee, and the latest 5 updates per story.

### POST /api/projects
Body: `{ "name", "description", "teamId" }`. You must be a member of that team.

### PUT /api/projects/:id
Body: `{ "name", "description" }`. Any team member.

### DELETE /api/projects/:id
Creator or team owner only. Cascades to stories, tasks, updates.

### GET /api/projects/:id/activity
Returns the last 30 updates across every story in the project, newest first. Each update is hydrated with author and story (`{ id, title }`) so the feed UI can link back.

---

## Stories

Stories live inside a project. Status is one of `TODO`, `IN_PROGRESS`, `DONE`. Assignee is optional.

### POST /api/stories
Body:
```json
{ "title": "Hero section", "description": "...", "projectId": "uuid", "assigneeId": "uuid|null" }
```
Returns the new story. Status defaults to `TODO` — you can't pass `status` here, only `PUT` can change it.

### PUT /api/stories/:id
Any of `{ title, description, status, assigneeId }`. Pass `assigneeId: null` to unassign.

### DELETE /api/stories/:id

> Note: the stories router doesn't apply `authenticateToken` itself — it's mounted under a parent that does. If you ever lift it out, remember to add the middleware.

---

## Tasks

Tasks are checklist items inside a story. Just `{ title, isCompleted }`.

### POST /api/tasks
Body: `{ "storyId", "title" }`.

### PUT /api/tasks/:id
Body: `{ "title", "isCompleted" }` (any subset).

### DELETE /api/tasks/:id

---

## Updates

The activity feed posts. Three types:

| Type       | Extra fields | Side effect |
|------------|--------------|-------------|
| `PROGRESS` | `progress` 0–100 | Sets story status to `IN_PROGRESS` for >0, or `DONE` for 100. |
| `BLOCKER`  | none | Surfaces at the top of the project until resolved. |
| `NOTE`     | none | Just a free-form share. |

### GET /api/updates/story/:storyId
List all updates for a story, newest first, with `author: { id, name }`.

### POST /api/updates
Body:
```json
{ "storyId": "uuid", "type": "PROGRESS", "message": "Halfway there", "progress": 50 }
```
- `type` must be one of the three above.
- For `PROGRESS`, `progress` is required and must be 0–100. The server rounds it.
- For `BLOCKER` and `NOTE`, `progress` is ignored.

### PUT /api/updates/:id/resolve
Marks a `BLOCKER` as resolved (so it disappears from the "active blockers" banner). 400 if the update isn't a blocker.

### DELETE /api/updates/:id
Author only.

---

## Auth header example

Quick smoke test from the shell:

```bash
TOKEN=$(curl -s -X POST http://localhost:8000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"secret123"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).token))")

curl -s http://localhost:8000/api/projects -H "Authorization: Bearer $TOKEN"
```
