# Note on AI Usage

I want to be straightforward about where AI was and wasn't part of this project, since that question matters.

## Where I used AI

- **Boilerplate and scaffolding.** Things like the initial `tsconfig`, the standard Express + ts-node starter, and the typical Vite + React + TS layout. I wrote a few lines, used AI to fill in the standard boilerplate, then read every line.
- **Spot lookups.** Quick questions like "what's the Express 5 type for `req.params` again" or "what does Prisma generate for a SetNull onDelete relation" — instead of digging through docs.
- **Phrasing in the docs.** I wrote the content of these report files myself based on the work I'd actually done; I used AI to clean up wording in a few paragraphs that sounded clunky on the first pass.
- **A second opinion.** A couple of times when I wasn't sure between two design options (httpOnly cookie vs localStorage, cascade vs soft delete), I'd describe the situation and have a back-and-forth before deciding. The decisions in `DESIGN_DECISIONS.md` are mine.

## Where I didn't

- **Architecture.** The split between client/server, the data model, the route layout, the permissions logic, the "what counts as a completed project" rule for the Team Profiles panel — all of that came out of me sketching in a notebook before I started typing.
- **Hard debugging.** When things broke (Prisma client not generating, a missing migration, the SQLite native binding mismatch), I read the actual stack traces and fixed them. AI is bad at "your `node_modules` were copied from a different machine".
- **Reading code.** I didn't paste the codebase into a chat and ask "what does this do". I know what every file does because I wrote it (or carefully read it before pasting it in).

## What I think this means

AI is genuinely useful as a faster, more conversational version of Stack Overflow and as a typing-saver for boilerplate. It's a poor substitute for understanding the code you're shipping. I tried to use it the first way and not the second.

If you'd like, I'm happy to walk through any part of the codebase in person — that's the easiest test of whether I actually built something or just generated it.
