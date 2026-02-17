# Copilot / AI Agent Instructions for this repo

This file gives targeted, actionable guidance to help an AI coding agent be immediately productive in this Next.js + Supabase + Tailwind project.

1. Project overview
- Framework: Next.js App Router (app/ directory). Key layout: `app/layout.tsx` provides global HTML, header/nav and imports `app/globals.css`.
- Auth: Supabase is the auth and DB provider. See `app/components/AuthGuard.tsx` for the single-client pattern and session checks.
- Styling: Tailwind CSS + PostCSS. Global styles live in `app/globals.css` and Tailwind config is in `tailwind.config.ts`.

2. How routing & protection work (examples)
- Pages live under `app/` (e.g. `app/dashboard/page.tsx`, `app/login/page.tsx`).
- Protected sections use the client-only `AuthGuard` component which:
  - Instantiates a single `supabase` client via `createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)`.
  - Calls `supabase.auth.getSession()` then `supabase.auth.onAuthStateChange()` and uses `router.replace('/login')` when unauthenticated. Keep this flow when modifying auth.

3. Important environment variables
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are required for client-side Supabase calls. Do not hardcode; use `process.env.` references as shown in `app/components/AuthGuard.tsx`.

4. Project scripts & local workflow
- Start dev server: `npm run dev` (calls `next dev`).
- Build: `npm run build` then `npm run start` to serve the production build.
- Lint: `npm run lint` runs `eslint`.

5. Patterns & conventions to follow
- Client vs Server: Files with `"use client"` at top are client components — they can use hooks like `useEffect`, `useRouter`, and `useState`. Keep heavy data fetching and secure secrets on server code (API routes or server components).
- Single Supabase client: Reuse a single `createClient` instance in client components rather than creating clients repeatedly. Follow `app/components/AuthGuard.tsx`.
- Navigation behavior: `NavLink` in `app/layout.tsx` hides the active link (returns null). Keep this pattern when adding new nav items.
- TypeScript path alias: `@/*` maps to repo root as configured in `tsconfig.json`. Use imports like `@/some/path` when helpful.

6. Common touchpoints for changes
- Adding a protected page: wrap content with `AuthGuard` (client component). Example: `app/dashboard/page.tsx`.
- Adding server-only API calls: place them in server components or Next API routes; avoid exposing server keys client-side.

7. Testing, debugging and PR guidance
- Local dev: `npm run dev` and open `http://localhost:3000`.
- When debugging auth flows, add logs around `supabase.auth.getSession()` and `onAuthStateChange`. Use `router.replace()` instead of `router.push()` for redirecting from guard to avoid back navigation issues.

8. Files to inspect for context
- `app/layout.tsx` — app shell and `NavLink` pattern
- `app/components/AuthGuard.tsx` — Supabase client + auth flow
- `app/globals.css`, `tailwind.config.ts` — styling setup
- `package.json` — scripts and dependency versions

9. What not to change without confirmation
- Changing environment variable names or Supabase initialization patterns.
- Replacing `router.replace` with `router.push` in the guard (causes back-button issues).

If any section is unclear or you want more examples (e.g., adding a new protected route or adjusting Supabase usage), tell me which part to expand or give a sample change to implement.
