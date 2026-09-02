# Group Polls

Dynamic polls for a friend group — single choice, multi-select, ranking, and
head-to-head bracket voting, with live-updating results. Anyone in a group
can start a poll and configure it: whether others can add options, whether
votes can change, whether results stay hidden until you vote, and more.

Stack: Next.js (App Router) + TypeScript + Tailwind + Supabase (Postgres,
Auth, Realtime), deployed on Vercel.

## Get started

See [SETUP.md](./SETUP.md) for creating the Supabase project, wiring up
Google sign-in, and deploying. Once `.env.local` is filled in:

```bash
npm install
npm run dev
```

## How it's put together

- `supabase/migrations/` — schema, row-level security, and the Postgres
  functions that do all the writing (`cast_ballot`, `record_matchup`,
  `add_poll_option`, `join_group_by_code`) and the uniform results read
  (`get_poll_results`). RLS is the actual authorization layer here, not the
  app — every Server Action runs as the signed-in user, never a service key.
- `lib/polls/schema.ts` — the Zod discriminated union that shapes a poll by
  `type`; this is the extension point for adding a fifth poll type later.
- `components/poll/` — one voting component per type (`VoteSingle`,
  `VoteMulti`, `VoteRank`, `VoteBracket`) plus a shared `ResultsPanel` that
  subscribes to Supabase Realtime so results move live as people vote.
