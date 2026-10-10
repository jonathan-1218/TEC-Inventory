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

**Project team logins.** A team registers at `/signup`: individual or group (2–10 members, each with name, roll number, department and year), project title, and a mentor picked from the list admins keep under **Sign-ups & mentors** (`/accounts`), plus a login email and password. Nothing is created until an admin approves it there; approval creates the project and its members (existing roll numbers are reused). An approved team logs in on `/login` → **Project team** and can post progress updates and manage tasks on its own project only, and sees its borrowed parts on **My project** (`/my`). Sessions are signed with `SESSION_SECRET` (falls back to `ADMIN_PASSWORD`).

**Login security.** Sessions are httpOnly cookies (never in local/session storage, unreadable by page scripts). Every write is authorised on the server, and member emails/phones are stripped server-side for non-admins. Admin login (`/admin`) and team login are rate limited in Postgres (shared by all serverless instances): 5 wrong admin passwords per IP / 30 overall per 15 min; 5 per team account and 20 per IP per 15 min; sign-ups 5 per IP / 60 overall per hour. Team passwords need 10+ characters, three character types (or 16+ characters), and can't be common or contain the team's email, names or roll numbers. There's no self-service password reset (an admin removes the login and the team registers again), so there's no reset endpoint to abuse.

**Admin 2FA.** Run `npm run totp:setup`, add the printed key to an authenticator app (Google Authenticator, Authy, 1Password…), and set `ADMIN_TOTP_SECRET` to it in Vercel (and `.env`). `/admin` then also asks for the 6-digit code; each code works once. Setting or changing it signs every admin out. Remove the variable to turn 2FA off.

**Goals.** Admins set a club-wide goal (e.g. 50% by a date) on `/accounts`, and can override it per project from the project page (**Set goal**). Expected progress rises in a straight line from the project's start to the goal; a project more than 10 points below that pace, or short of the goal after its date, is flagged on its project page, on the team's **My project** page, and under **Needs attention** on the dashboard.

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

Why session mode: the transaction pooler (port 6543) doesn't support prepared statements, and Prisma's `?pgbouncer=true` workaround costs several extra round trips per query (~650 ms instead of ~130 ms per query to a far-away region). For a long-running server (`npm run dev`, `npm start`, a VM) session mode is Supabase's recommendation. For serverless hosting (e.g. Vercel) set `DATABASE_URL` to the transaction pooler instead: port 6543 with `?pgbouncer=true&connection_limit=5&pool_timeout=20`. Without `pgbouncer=true` Prisma fails with "prepared statement … does not exist"; with a limit of 1 the dashboard's parallel queries time out waiting for a connection.

### Deploying to Vercel

- `vercel.json` pins functions to **Tokyo (`hnd1`)**, next to the Supabase project (`ap-northeast-1`). Every query is a network round trip, so a function in another region makes pages several seconds slower — change the region if your Supabase project lives elsewhere.
- Project → Settings → Environment Variables: `DATABASE_URL` (transaction pooler, as above), `DIRECT_URL` (session pooler, port 5432), `ADMIN_PASSWORD`. Environment variable changes only apply to new deployments — redeploy after editing them.
- The database schema isn't pushed during the build; run `npm run db:push` locally (with `.env` pointing at the same project) after schema changes.

Pick a Supabase region close to where the app runs — every query pays the round trip.

Any Postgres works too (local, Neon, RDS…): point both URLs at it.

### Supabase security note

Supabase publishes the `public` schema through its Data API, where anyone with your project's anon key could otherwise read and write these tables. `npm run dev` / `npm run db:push` run `prisma/enable-rls.sql`, which turns on Row Level Security with no policies for the app's tables. The app itself connects as the table owner, so it is unaffected; the Data API gets nothing.

## Google Sheets sync

The club's **Components list** sheet stays in step with the app. A moment after any change (adding, editing or deleting a part, issuing, returning…) the app rewrites the **COMPONENTS** table:

| Column | From the app |
| --- | --- |
| COMPONENT NAME, TOTAL | the part |
| TYPE | the part's category, as the closest dropdown option. An existing TYPE is kept while it still fits the category (e.g. DEVELOPMENT KITS or a blank for an uncategorised part); changing the category in the app rewrites it. |
| TEC CLUB USAGE | ticked once the part has ever been checked out |
| USED QTY | units out right now |
| RETURN STATUS | ticked when everything that went out has come back |
| AVAILABLE QTY | working units not on loan |
| PURPOSE, PROJECT NAME | notes and projects of the open checkouts (or the latest one, once all are back) |

The header row, formatting, dropdowns, checkboxes and the other tabs are never touched; leftover table rows are blanked and the table grows if needed. It's one-way — edits typed into those rows are overwritten on the next sync (use other tabs or columns for your own notes). If the header is renamed or reordered the sync stops with an error instead of writing under the wrong headings. Admins also get **Sync to Sheets** (and a link to the sheet) on the Inventory page. Sheets keeps version history (File → Version history) if you ever need an older state.

Setup (once):

1. Google Cloud Console → create a project → **APIs & Services → Enable APIs** → enable **Google Sheets API**.
2. **IAM & Admin → Service Accounts → Create service account** (no roles needed) → **Keys → Add key → JSON**. If key creation is blocked by the `iam.disableServiceAccountKeyCreation` organization policy, grant yourself *Organization Policy Administrator* on the organization and override that policy (Enforcement off) for this project only.
3. **Share** the sheet with the service account's email (`…@….iam.gserviceaccount.com`) as **Editor**.
4. Set `GOOGLE_SHEET_ID` to the sheet's URL and `GOOGLE_SERVICE_ACCOUNT_KEY` to the key file base64-encoded (`base64 -i key.json | pbcopy`) — in `.env` for local and in Vercel → Environment Variables (then redeploy). Keep the key file outside the project folder.
5. Click **Sync to Sheets** once.

Leave both variables empty to turn syncing off. Keep the key secret — anyone holding it can edit sheets shared with that account.

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
