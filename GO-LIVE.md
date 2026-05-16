# Go-live in ~30 minutes

The shortest path from "running on my laptop" to "a private webapp my colleagues can sign into, with one shared dataset that everyone sees the same version of".

You need two free accounts: **Supabase** (the shared database + the password system) and **Vercel** (the hosting). Neither requires a credit card.

The data flow is simple: every browser talks to the same Supabase database. Person A drags a project; the change is saved to Supabase; Person B sees it next time their browser reloads.

---

## 1) Push the code to GitHub  ·  ~5 min

1. Sign in at https://github.com.
2. Click **New** → name the repo (e.g. `staffing-planner`) → **Private** → **Create repository**.
3. In PowerShell, in the project folder (`C:\Users\KoenPijnappels\projects\staffing-planner`), copy-paste the block GitHub shows under *"…push an existing repository from the command line"*. It looks like:
   ```
   git init
   git add .
   git commit -m "first version"
   git branch -M main
   git remote add origin https://github.com/<your-username>/staffing-planner.git
   git push -u origin main
   ```
4. Refresh the GitHub page — you should see all your files.

---

## 2) Spin up the Supabase backend  ·  ~10 min

1. Sign in at https://supabase.com (use "Sign in with GitHub" to skip yet another password).
2. **New project** → pick a name (`staffing-planner`) → set a strong **database password** and write it down — it's an emergency-only password — → choose the closest region (Frankfurt / Amsterdam) → **Create project**. Wait ~1 minute.
3. Left sidebar → **SQL Editor** → **New query**. In your project folder open `supabase/schema.sql`, copy the full file, paste, click **Run**. It should say "Success. No rows returned."
4. Left sidebar → **Authentication** → **Providers** → make sure **Email** is on, then below it turn **Confirm email** **OFF** (small team — saves the confirmation-link annoyance).
5. Same sidebar → **Authentication** → look for the setting **"Allow new users to sign up"** — turn it **OFF**. From now on only you can create accounts.
6. **Authentication → Users → Add user**. Create one account per colleague (their email + a temporary password). Send them their password privately. They can change it later.
7. **Project Settings (gear, bottom-left) → API**. Copy these two values, you'll paste them into Vercel:
   - **Project URL** (`https://xxx.supabase.co`)
   - **anon public** key (`eyJ...`)

---

## 3) Put it on the internet via Vercel  ·  ~10 min

1. Sign in at https://vercel.com with GitHub.
2. **Add New → Project**. Find your `staffing-planner` repo → **Import**.
3. Don't change any of the framework settings — Vercel sees it's Next.js. Just expand **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | the Project URL from Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key from Supabase |

4. **Deploy**. ~2 minutes. You'll get a URL like `staffing-planner-abc123.vercel.app`.
5. Back in Supabase: **Authentication → URL Configuration**. Set:
   - **Site URL** = your Vercel URL (`https://staffing-planner-abc123.vercel.app`)
   - **Redirect URLs** = same URL with `/**` on the end (`https://staffing-planner-abc123.vercel.app/**`)
   - **Save**.

Open the Vercel URL. It redirects you to a sign-in page. Use one of the accounts you created. You should land on the planning board with no data — your real database is empty.

---

## 4) Seed your real data  ·  one-time

Have one person enter the starting picture. The order matters a little:

1. **People (Planning Board)** — top-right `+` icon → add each colleague who's missing. The 22 people from the mock-up are gone now; you're starting fresh from a clean database.
2. **Projects (Projects tab)** — click *New project*. The dates here become the default for the role demands you'll add next.
3. **Role demands** — click any project row to expand it → *Add role*. Repeat per role per project.
4. **Allocations** — back to the Planning Board, drag each open demand (right panel) onto the person who'll do it. Dates lock to the demand; dragging only sets who is doing it.
5. **Holidays** — Import / Export tab → drop the team holiday spreadsheet. Re-importing later **replaces** the previous load.

When all of that is done, share the Vercel URL with the team along with their passwords.

---

## What changes vs the laptop version

| | Laptop now | Live (after this guide) |
|---|---|---|
| Where the data lives | Memory — gone on refresh | Supabase Postgres — permanent |
| Who can see it | Only your browser | Everyone with a password |
| Login screen? | No | Yes |
| Same data for everyone? | No | Yes (refresh to see other people's changes) |
| Address | `localhost:3000` | `staffing-planner-…vercel.app` |

---

## Day-to-day

- **Updating the app** — push a commit to GitHub and Vercel redeploys in ~2 min. The data is in Supabase and isn't touched.
- **Adding a new colleague** — Supabase → Authentication → Users → Add user. Give them the temp password.
- **Resetting a password** — Supabase → Authentication → Users → click the row → set a new password.
- **Removing a colleague** — Supabase → Authentication → Users → delete them. Their existing entries in the planner stay; only their ability to sign in is removed.
- **Seeing someone else's changes** — refresh the page. We chose not to use realtime push, so the page doesn't update on its own; clicking around or reloading shows the latest.

---

## If something doesn't work

- **Blank page after sign-in** — hard-refresh (Ctrl+Shift+R). Still blank? F12 → Console tab → forward the red lines to a developer.
- **"Invalid login credentials"** — check the email + temp password; verify "Confirm email" is OFF in Supabase Auth settings.
- **Login loops back to login** — the Vercel URL probably isn't in Supabase's allowed Redirect URLs (step 3.5).

That's it. Three free accounts, ~30 minutes, and the team is live.
