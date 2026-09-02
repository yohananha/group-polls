-- ============================================================================
-- 0002_polls.sql — polls, options, ballots, and bracket matchups
-- ============================================================================

create type poll_type as enum ('single', 'multi', 'rank', 'bracket');
create type poll_status as enum ('open', 'closed');

create table polls (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references groups(id) on delete cascade,
  author_id    uuid not null references profiles(id),
  question     text not null check (char_length(question) between 1 and 300),
  description  text,
  type         poll_type not null,
  -- Dynamic per-poll settings — see lib/polls/schema.ts for the Zod shape
  -- that's actually enforced. Keeping this as jsonb means new settings don't
  -- need a migration.
  settings     jsonb not null default '{}'::jsonb,
  status       poll_status not null default 'open',
  closes_at    timestamptz,
  created_at   timestamptz not null default now()
);

create table poll_options (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references polls(id) on delete cascade,
  label       text not null check (char_length(label) between 1 and 200),
  image_url   text,
  added_by    uuid not null references profiles(id),
  position    int not null default 0,
  approved    boolean not null default true,
  created_at  timestamptz not null default now()
);

-- One ballot per (poll, voter). This unique constraint is the entire
-- anti-double-vote mechanism — enforced by Postgres, not app logic that a
-- race condition (two tabs, a retried request) could get around.
create table ballots (
  id          uuid primary key default gen_random_uuid(),
  poll_id     uuid not null references polls(id) on delete cascade,
  voter_id    uuid not null references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (poll_id, voter_id)
);

-- Rows here are the actual selections. `rank` is used by rank polls (lower =
-- higher preference, 1-based); null for single/multi where order doesn't
-- matter.
create table ballot_entries (
  ballot_id   uuid not null references ballots(id) on delete cascade,
  option_id   uuid not null references poll_options(id) on delete cascade,
  rank        int,
  primary key (ballot_id, option_id)
);

-- Bracket polls don't fit the ballot shape (many pairwise judgments per
-- voter, not one selection) so they get their own table.
create table matchups (
  id                uuid primary key default gen_random_uuid(),
  poll_id           uuid not null references polls(id) on delete cascade,
  voter_id          uuid not null references profiles(id),
  option_a_id       uuid not null references poll_options(id),
  option_b_id       uuid not null references poll_options(id),
  winner_option_id  uuid not null references poll_options(id),
  created_at        timestamptz not null default now(),
  check (option_a_id <> option_b_id),
  check (winner_option_id in (option_a_id, option_b_id))
);

create index polls_group_id_idx on polls(group_id, created_at desc);
create index poll_options_poll_id_idx on poll_options(poll_id);
create index ballots_poll_id_idx on ballots(poll_id);
create index ballot_entries_option_id_idx on ballot_entries(option_id);
create index matchups_poll_id_idx on matchups(poll_id);
create index matchups_voter_idx on matchups(poll_id, voter_id);

-- Stops the same voter recording the same pair twice (in either order) —
-- belt-and-braces against a race between two tabs racing record_matchup().
create unique index matchups_unique_pair_idx
  on matchups (poll_id, voter_id, least(option_a_id, option_b_id), greatest(option_a_id, option_b_id));

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table polls enable row level security;
alter table poll_options enable row level security;
alter table ballots enable row level security;
alter table ballot_entries enable row level security;
alter table matchups enable row level security;

create policy "members can read polls in their group"
  on polls for select
  to authenticated
  using (is_member(group_id));

create policy "members can create polls in their group"
  on polls for insert
  to authenticated
  with check (is_member(group_id) and author_id = auth.uid());

create policy "authors can update or close their own poll"
  on polls for update
  to authenticated
  using (author_id = auth.uid() and is_member(group_id));

create policy "authors can delete their own poll"
  on polls for delete
  to authenticated
  using (author_id = auth.uid() and is_member(group_id));

create policy "members can read options for polls in their group"
  on poll_options for select
  to authenticated
  using (is_member((select group_id from polls where id = poll_id)));

-- Option inserts are only ever done through the add_poll_option() function
-- (0003), which checks the poll's allow_option_adds setting and applies the
-- approval flow. No direct insert policy for members here.
create policy "poll author can add options directly"
  on poll_options for insert
  to authenticated
  with check (
    added_by = auth.uid()
    and exists (select 1 from polls where id = poll_id and author_id = auth.uid())
  );

-- Ballots: you can only ever see/insert your own ballot row. Aggregate counts
-- are read through get_poll_results(), not by scanning ballots directly.
create policy "members can read their own ballot"
  on ballots for select
  to authenticated
  using (voter_id = auth.uid());

create policy "members can cast a ballot in their group"
  on ballots for insert
  to authenticated
  with check (
    voter_id = auth.uid()
    and is_member((select group_id from polls where id = poll_id))
  );

create policy "members can change their own ballot when the poll allows it"
  on ballots for update
  to authenticated
  using (
    voter_id = auth.uid()
    and coalesce((select (settings->>'allow_vote_change')::boolean from polls where id = poll_id), false)
  );

create policy "members can delete their own ballot when the poll allows it"
  on ballots for delete
  to authenticated
  using (
    voter_id = auth.uid()
    and coalesce((select (settings->>'allow_vote_change')::boolean from polls where id = poll_id), false)
  );

-- ballot_entries visibility is the enforcement point for results_visibility:
-- 'after_vote' polls only let you read entries once you have your own
-- ballot; 'after_close' only once the poll is closed. This runs on the
-- replication stream too, so Realtime can't leak a blind poll's tally.
create policy "read ballot_entries per poll's results_visibility"
  on ballot_entries for select
  to authenticated
  using (
    exists (
      select 1
      from ballots b
      join polls p on p.id = b.poll_id
      where b.id = ballot_entries.ballot_id
        and is_member(p.group_id)
        and (
          coalesce(p.settings->>'results_visibility', 'always') = 'always'
          or (
            coalesce(p.settings->>'results_visibility', 'always') = 'after_vote'
            and exists (select 1 from ballots mine where mine.poll_id = p.id and mine.voter_id = auth.uid())
          )
          or (
            coalesce(p.settings->>'results_visibility', 'always') = 'after_close'
            and p.status = 'closed'
          )
          -- you can always read your own entries, regardless of visibility
          or exists (select 1 from ballots mine where mine.id = ballot_entries.ballot_id and mine.voter_id = auth.uid())
        )
    )
  );

create policy "members write entries onto their own ballot"
  on ballot_entries for insert
  to authenticated
  with check (
    exists (select 1 from ballots b where b.id = ballot_id and b.voter_id = auth.uid())
  );

create policy "members delete entries on their own ballot"
  on ballot_entries for delete
  to authenticated
  using (
    exists (select 1 from ballots b where b.id = ballot_id and b.voter_id = auth.uid())
  );

create policy "matchups follow the same visibility rule as ballot_entries"
  on matchups for select
  to authenticated
  using (
    exists (
      select 1 from polls p
      where p.id = matchups.poll_id
        and is_member(p.group_id)
        and (
          coalesce(p.settings->>'results_visibility', 'always') in ('always', 'after_vote')
          or p.status = 'closed'
          or voter_id = auth.uid()
        )
    )
  );

create policy "members record their own matchup judgment"
  on matchups for insert
  to authenticated
  with check (
    voter_id = auth.uid()
    and is_member((select group_id from polls where id = poll_id))
  );
