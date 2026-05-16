# Staffing Planner

Internal resource planning web app for a small consultancy office (~20 people).
Replaces an Excel-based staffing overview with a modern, collaborative planning board.

## Privacy policy

**⚠ Real names are prohibited in this repository.**

- Do NOT use real employee names in seed data, test files, comments, or documentation.
- Do NOT use real client names or real project names anywhere in the codebase.
- Do NOT commit real Excel staffing files, exports, or screenshots containing actual data.
- Use the anonymized placeholders already in `seed/data.ts` (Person 01–20, Client Alpha–Kappa, etc.).
- Do NOT log individual imported row data to the browser console or server logs.

## Stack

| Concern | Library |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Styling | Tailwind CSS v4 |
| UI primitives | Radix UI + custom shadcn-style components |
| Drag-and-drop | dnd-kit |
| Date utilities | date-fns |
| Database | Supabase (Postgres) |
| Auth | Supabase email + password (via `@supabase/ssr`) |
| Local mock mode | `lib/data/mock-store.ts` |

## Screens

| Screen | Route | Status |
|---|---|---|
| Planning Board | `/planning` | ✅ |
| Projects & Demand | `/projects` | ✅ |
| Insights Dashboard | `/insights` | ✅ |
| Import / Export | `/import-export` | 🚧 stub |

## Local development (no Supabase required)

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app falls back to in-memory seed data
from `seed/data.ts` whenever `NEXT_PUBLIC_SUPABASE_URL` is not set. A yellow "Mock Mode" banner
appears in the sidebar to confirm.

## Deploying to Vercel + Supabase

### 1. Create the Supabase backend

1. Sign up at [supabase.com](https://supabase.com) and create a new project (free tier is fine).
2. Open SQL Editor → paste the full contents of `supabase/schema.sql` → run.
3. Authentication → Providers → enable **Email**. Disable "Enable sign ups" so only admins
   can create accounts.
4. Authentication → Users → "Add user" for each team member (set a temporary password;
   members can change it on first login through the dashboard).
5. Project Settings → API → copy the **Project URL** and the **anon (public) key**.

### 2. Deploy the app to Vercel

1. Push this repo to GitHub.
2. In Vercel, "Import Project" from that GitHub repo. Vercel auto-detects Next.js.
3. Under **Environment Variables**, add:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ…` (anon key from the dashboard) |

4. Deploy. Vercel gives you a `<project>.vercel.app` URL.
5. Back in Supabase → Authentication → URL Configuration → set **Site URL** to the
   Vercel URL and add it to **Redirect URLs**.

### 3. Local development against Supabase

Copy `.env.local.example` to `.env.local` and fill in the same two values:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ…
```

Restart `npm run dev`. The Mock Mode banner disappears; you're now authenticated against
the real database. Hitting any page without an active session redirects to `/login`.

## How auth + data sync work

- `proxy.ts` (Next 16 proxy convention) gates every page request. When Supabase is configured,
  it checks the session cookie via `@supabase/ssr` and redirects unauthenticated requests to `/login`.
- `lib/supabase/client.ts` (browser) and `lib/supabase/server.ts` (proxy) share the same session
  cookie so server and client agree on who's logged in.
- `lib/data/mock-store.ts` is the single entry point for components. When Supabase is configured
  it transparently forwards every read and write to `lib/data/supabase-store.ts`, which keeps a
  local in-memory cache and persists mutations to Postgres in the background (optimistic updates).
- The undo button is client-side; it works in both modes.

## Project structure

```
app/                      Next.js App Router pages
  login/                  Email + password login form
  planning/               Planning Board
  projects/               Project Demand view
  insights/               Utilization dashboard
  import-export/          Excel import/export (stub)
components/
  layout/                 AppShell, Sidebar
  planning-board/         Grid, week cells, assignment spans
  projects/               Project table view + role demand sub-table
  insights/               Dashboard with utilization heatmap
  ui/                     Minimal component library
lib/
  calculations/staffing   Utilization, allocation, demand calculations
  data/mock-store         Data layer entry point (mock + Supabase modes)
  data/supabase-store     Supabase CRUD + camel/snake mapping
  dates/weeks             ISO week utilities
  supabase/client         Browser-side Supabase client
  supabase/server         Server-side client for proxy.ts
  ui/projectColors        Status -> colour mapping
proxy.ts                  Edge auth gate (replaces middleware.ts in Next 16)
types/index.ts            All TypeScript types
seed/data.ts              Anonymized seed data
supabase/schema.sql       Database schema + RLS policies
```

## Planning logic

- Planning horizon: next 13 ISO weeks (Monday–Sunday).
- Capacity unit: days per week (can be decimal, e.g. 4.5).
- `availableDays = contractDaysPerWeek - unavailableDaysPerWeek`
- `utilization = assignedDays / availableDays * 100`
- Over-allocated when `assignedDays > availableDays`.
- Holiday exceptions reduce available days for the overlapping week.

## Colour coding (planning board bars)

| Colour | Meaning |
|---|---|
| Green | Sold |
| Blue (probability-shaded) | Planned — darker = higher probability |
| Purple | Internal / non-billable |
| Hatched grey | Holiday / unavailable |
| Red highlight | Over-allocated week |

## Useful commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run start        # run the production build locally
npm run type-check   # tsc --noEmit, no compile output
```
