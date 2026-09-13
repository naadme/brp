# Bro, Don’t — Bad Advice Generator

A polished, anonymous social game for trading hilariously terrible (but safe) advice. This MVP is designed to be runnable the minute it is cloned.

## What ships

- Anonymous play plus a sign-up/sign-in flow (email, handle, and password) with validation
- Situation posting, categories, rich feed, trending sort, and a Daily Worst Advice card
- Bad-advice posting, voting, “Make it worse,” share-to-clipboard, and content reporting
- Points, personal stats, a leaderboard, responsive mobile navigation, and seeded demo content
- Lightweight anti-spam guardrails: required minimum text lengths, max lengths, one-vote toggle per device, and a 15-second per-device posting cooldown

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). Build a production bundle with `npm run build`.

## Architecture and deployment

This is a Vite + React + TypeScript website. `src/game-api.ts` is the deliberately isolated data/auth adapter, so the existing UI can run locally today and be connected to Google sign-in, Supabase, Firebase, or another server later without redesigning the site.

The bundled email/password flow is a local demonstration: data remains in the browser and is not suitable for a public deployment. Before sharing it publicly, connect a real authentication and database provider so passwords, accounts, posts, votes, moderation, and rate limiting live on the server.

Deploy the generated `dist/` directory to Vercel, Netlify, Cloudflare Pages, or any static host. For a multi-user launch, retain the UI and replace the small state layer in `src/main.tsx` with a hosted API (for example Supabase/Postgres); enforce authentication, database-backed rate limits, server-side voting uniqueness, report queues, and moderation actions there.

## Product safety note

The game rewards *obviously bad, comedic* suggestions—not real-world harmful or illegal guidance. The UI includes reporting, but a public release should add server-side moderation and a visible community policy.
