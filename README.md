# Trajectory

Turns an ambitious long-term goal into a realistic execution plan, daily actions, and adaptive replanning as reality diverges from the plan. See `docs/PRODUCT-ARCHITECTURE.md` for the full product and system architecture.

## Getting started

1. Install dependencies:

   ```bash
   pnpm install
   ```

2. Create a Supabase project, then copy `.env.example` to `.env.local` and fill in every value. See the comments in `.env.example` for where each one comes from.

3. Apply the database schema:

   ```bash
   supabase link --project-ref <your-project-ref>
   supabase db push
   ```

   This runs the migrations in `supabase/migrations/`, which create the schema, enable row-level security, and install the `owner_all` RLS policies described in `docs/PRODUCT-ARCHITECTURE.md` §4.

4. Run the dev server:

   ```bash
   pnpm dev
   ```

   Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | Start the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve a production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Run the Vitest suite (domain logic, eval fixtures, UI copy lint) |

## Deployment

Deployed on Vercel. `vercel.json` registers the daily cron (`/api/cron/daily`, 03:00 UTC) that evaluates replan triggers and rolls plan weeks forward — see `docs/PRODUCT-ARCHITECTURE.md` §8.3. Set `CRON_SECRET` as a Vercel environment variable so Vercel Cron authenticates its own requests to that route.

## Docs

- `docs/PRODUCT-ARCHITECTURE.md` — system architecture, domain model, AI architecture, acceptance criteria
- `docs/LAUNCH-AUDIT.md` — pre-launch readiness audit
