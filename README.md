# SDSAIFAT — DSA Practice Studio

A React + TypeScript coding-practice application with a hybrid dashboard and focused problem workspace.

## Current starter

- Responsive dark dashboard and activity calendar
- Problem list and problem workspace UI
- Monaco Java editor
- Google OAuth integration path using Supabase Auth
- Imported 350-row problem catalogue from the supplied spreadsheet
- Local auto-saved Java drafts and self-reported problem status/progress tracking
- Problem filtering by completion status; progress and streak metrics derived from local practice history
- Judge0 submission and result polling for the Run button
- Streak calculation helpers (local calendar dates)

## Progress and draft storage

Practice status, code drafts, and manually marked completions are saved in this browser using local storage. They do not sync between devices yet. The spreadsheet provides problem titles and topic categories, but does not include verified difficulty labels, complete problem statements, or test cases; the UI links to the original problem where available and does not claim automated acceptance.

## Cloudflare Workers deployment

The repository includes a Wrangler configuration for the `sdsaifat` Worker. The Cloudflare Worker build should run `npm run build` and then `npx wrangler deploy`. Static assets are served from `dist`, and `/api/*` routes execute in the Worker before the SPA fallback. Set `JUDGE0_API_URL` as a server-side Worker secret. Add `JUDGE0_API_KEY` only if the execution provider requires it.

## Run locally

Prerequisites: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Then open the local URL printed by Vite.

## Google authentication

1. Create a Supabase project.
2. In Supabase, go to Authentication → Providers and enable Google.
3. Set up Google OAuth credentials in Google Cloud Console, then enter the client ID and secret in Supabase (the Google client secret belongs in Supabase, never in this repo).
4. Add the Supabase project URL and publishable/anon key to `.env.local`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
5. Add your local and deployed site URLs to Supabase Authentication URL Configuration, including the redirect URL used by Google OAuth.

The app uses optional configuration so the UI can be explored before Supabase is connected. No private key should be prefixed with `VITE_`.

## Java code execution

The Monaco editor is included. Execution is **not ready for production until a trusted server-side endpoint is configured**. Deploy the app on Vercel (or another host that supports the `api/run.ts` serverless handler), then set the server-only `JUDGE0_API_URL` environment variable to your Judge0 `/submissions` endpoint. If required by your provider, set `JUDGE0_API_KEY` as a server-side secret. The browser calls `/api/run`; provider credentials are never sent to the browser.

Important security notes:
- Keep `JUDGE0_API_KEY` server-side; do not use a `VITE_` prefix for secrets.
- The included `api/run.ts` serverless endpoint forwards Java submissions to Judge0, applies time limits, and polls asynchronous results.
- Configure execution time and memory limits and validate request sizes.
- The Run button sends Java (Judge0 language ID 62) source code and polls token-based results when the provider responds asynchronously. The Submit button deliberately refuses to claim an accepted verdict while verified test cases are missing. The imported spreadsheet contains problem titles/topics, not complete statements or test cases.
- Hidden tests and expected outputs must never be delivered to the frontend.

## Problem catalogue

Problem data lives in `src/data/problems.ts`; it currently includes the 350 spreadsheet rows in sheet order with topic tags and original LeetCode links generated from problem titles. Since the spreadsheet does not supply full statements, difficulty, examples, constraints, or verified test cases, these fields are not fabricated. The current generic Java starter template is only a placeholder, not a problem-specific method signature.

## Streak / activity integration

`src/lib/streak.ts` contains local-calendar streak helpers. Current activity shown in the UI is placeholder sample data for visual development, not persisted user history. Before public launch, replace it with Supabase-backed per-user submissions/activity and use row-level security policies.

Recommended database shape:
- `problems`: curated problem metadata and statement
- `submissions`: user ID, problem ID, code, verdict, execution time, created timestamp
- `daily_activity`: user ID, local date, accepted solve count

Apply row-level security so users can only read/write their own submissions and activity. Use a server-trusted timestamp and a clearly documented timezone policy when calculating streaks.

## Build

```bash
npm run build
```

## Not yet configured

- Supabase project credentials and Google OAuth app
- Configure `JUDGE0_API_URL` and, if required, `JUDGE0_API_KEY` in the deployment environment and test the hosted `/api/run` endpoint
- Server-side Submit evaluation and private test cases
- User progress persistence and database RLS
- Real user activity replacing placeholder dashboard samples
- Full official statements, difficulty metadata, problem-specific Java starter signatures, and reviewed test cases
