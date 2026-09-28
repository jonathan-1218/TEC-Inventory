# TEC Inventory & Projects

Inventory, checkout and project tracker for the TEC tech club.

- **Dashboard** – a plain-language status line ("3 returns overdue · 2 parts low on stock …"), KPI readouts with sparklines, checkouts over 7/30/90 days, inventory health by category, projects in motion, team snapshot, a 26-week activity heatmap, and a "needs attention" list with one-click Return / Extend.
- **Inventory** – every component with working / damaged / under-repair counts, live availability, category breakdown, quick filters, CSV export, and a per-part checkout history chart.
- **Issuances** – check units out to members (optionally for a project); Active / Overdue / Due soon / History tabs; partial returns with Working / Damaged / Lost conditions update stock automatically; extend due dates; CSV export.
- **Projects** – grid, drag-and-drop **board** by status (mouse or keyboard) and **roadmap** timeline; each project has members, tech stack, required components vs issued, a progress-over-time chart and an update timeline.
- **Tasks** – per-project tasks (status, priority, assignee, due date) on a board or checklist; `/tasks` tracks everything across projects, and task completion suggests project progress.
- **Teams & Members** – team pages with projects, roster, open tasks and parts on loan; member pages with an activity heatmap, checkouts, tasks and projects.
- **Everywhere** – light and dark themes in the logo's palette, an animated logo intro once per browser session (skippable with Esc, off under reduced motion), and a ⌘K / Ctrl+K palette for navigation, actions and search.

Anyone can browse. Adding, editing, issuing, returning and deleting require the admin password.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · shadcn/ui · Prisma 6 · Postgres on Supabase · zod.

## Quick start

Requires Node.js 22+ and a Supabase project (the free tier is plenty; pick the region closest to you, e.g. Mumbai). Use a project dedicated to TEC — the app creates tables named `Component`, `Member`, `Team`, `Project`, … in the `public` schema.

```bash
npm install
cp .env.example .env
```

In `.env`:

1. Supabase dashboard → your project → **Connect** → **Session pooler** (port 5432). Paste that string as both `DATABASE_URL` (with `?connection_limit=10` on the end) and `DIRECT_URL`, and replace `[YOUR-PASSWORD]` with your database password (reset it under Project Settings → Database if you don't have it).
2. Set `ADMIN_PASSWORD` to something only the club admins know.

Then:

```bash
npm run dev
```

Open http://localhost:3000. The first run creates the tables in Supabase, locks them down (below) and loads sample data. Click **Admin login** (top right) and enter `ADMIN_PASSWORD` to unlock editing. When you're ready for real data, clear the samples from the dashboard/Prisma Studio or start from an empty project and skip the seed.

## Environment

| Variable         | Purpose                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `DATABASE_URL`   | Supabase session pooler (port 5432, `?connection_limit=10`) used by the app |
| `DIRECT_URL`     | Same session pooler, used by `prisma db push`                             |
| `ADMIN_PASSWORD` | Unlocks all write actions. Changing it signs every admin out.             |

Why session mode: the transaction pooler (port 6543) doesn't support prepared statements, and Prisma's `?pgbouncer=true` workaround costs several extra round trips per query (~650 ms instead of ~130 ms per query to a far-away region). For a long-running server (`npm run dev`, `npm start`, a VM) session mode is Supabase's recommendation. Only for serverless hosting (e.g. Vercel) switch `DATABASE_URL` to port 6543 with `?pgbouncer=true&connection_limit=1`.

Pick a Supabase region close to where the app runs — every query pays the round trip.

Any Postgres works too (local, Neon, RDS…): point both URLs at it.

### Supabase security note

Supabase publishes the `public` schema through its Data API, where anyone with your project's anon key could otherwise read and write these tables. `npm run dev` / `npm run db:push` run `prisma/enable-rls.sql`, which turns on Row Level Security with no policies for the app's tables. The app itself connects as the table owner, so it is unaffected; the Data API gets nothing.

## Scripts

| Command             | What it does                                                      |
| ------------------- | ----------------------------------------------------------------- |
| `npm run dev`       | Sync the schema, enable RLS, seed if the DB is empty, start the dev server |
| `npm run build`     | Production build (`npm start` to serve it)                        |
| `npm run setup`     | Sync the schema, enable RLS and **wipe + reseed** sample data     |
| `npm run db:push`   | Sync the schema and enable RLS (no data changes)                  |
| `npm run db:seed`   | **Wipe** the app's tables and load the sample data again          |
| `npm run db:studio` | Browse/edit the raw tables in Prisma Studio                       |
| `npm run check`     | Stock-logic and validation self-check in a throwaway schema (dropped afterwards) |
| `npm run typecheck` | TypeScript check                                                  |
| `npm run lint`      | ESLint                                                            |

## How stock is counted

- `working + damaged + underRepair = total` is enforced on every save.
- Issued units still count as **working**; **available = working − units on open issuances**. It is computed, never stored, so it can't drift.
- Returning units as **Working** makes them available again, **Damaged** moves them from working to damaged, **Lost** removes them from the total.
- A component with open issuances can't be deleted, and its working count can't be edited below what is currently issued.
- A project's "issued" count for a required component is the number of units currently checked out for that project; issuing for a project that didn't list the component adds it as a requirement.

## Using SQLite instead

For a quick offline setup: in `prisma/schema.prisma` set `provider = "sqlite"` and remove the `directUrl` line, set `DATABASE_URL="file:./dev.db"` in `.env`, and drop the `prisma db execute …enable-rls.sql` step from the `predev`/`setup`/`db:push` scripts (RLS is Postgres-only). `npm run check` needs Postgres.

## Project layout

```
prisma/schema.prisma      data model
prisma/seed.ts            sample data (dates are relative to today)
prisma/enable-rls.sql     locks the tables away from Supabase's Data API
src/app/                  routes: / inventory issuances projects tasks teams members search login
src/app/actions/          server actions (admin check + zod validation + revalidation)
src/app/api/export/       admin-only CSV export (components, issuances, members, projects, tasks)
src/lib/stock.ts          issue / return / extend logic (transactional)
src/lib/tasks.ts          task ordering + completion helpers
src/lib/analytics.ts      dashboard / chart queries (batched — each round trip to Supabase costs ~100 ms+)
src/lib/validators.ts     zod schemas shared by forms and actions
src/lib/queries.ts        read helpers (availability, search)
src/components/charts/    themed chart kit (sparkline, trend, stacked bars, ring, heatmap, bar list)
src/components/intro/     the logo intro animation
src/components/tec-logo.tsx  vector logo (public/brand/tec-logo.svg is a static copy)
src/components/           feature UI (dashboard, projects, tasks, …) and shared dialogs; ui/ is shadcn
src/app/chart-kit/        dev-only showcase of the chart kit (404 in production)
scripts/check-stock.ts    stock logic self-check
scripts/predev.mjs        creates .env and stops early if the database URLs aren't filled in
```

## Auth

A single admin password from `ADMIN_PASSWORD`. Logging in sets an httpOnly cookie containing an HMAC of a fixed label keyed by the password, so it can't be forged and rotating the password logs everyone out. Every server action re-checks it; read-only pages don't require it.
