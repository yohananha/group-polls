-- ============================================================================
-- 0008_fair_scoring.sql — score options on the voters who actually saw them
--
-- Two problems this fixes.
--
-- 1. `allow_option_adds` lets members add options mid-poll, but everyone who
--    already voted never saw them. Raw counts therefore rank an option by how
--    early it existed, not by how much people like it: an option added once
--    8 of 12 members have voted cannot exceed 4 votes no matter how good it
--    is. Rank polls were worse — the old score was
--    `sum(<count of approved options> - rank)` with that count evaluated at
--    READ time, so adding an option retroactively inflated every already-cast
--    ballot's contribution to the incumbents while the newcomer started at 0.
--
-- 2. Nothing exposed a denominator. The UI could say "5 votes" but not
--    "5 of 9", and nothing distinguished a 1st-place finish from a last-place
--    one in a rank poll.
--
-- The fix starts from IMDb's weighted rating, WR = (v/(v+m))*R + (m/(v+m))*C,
-- with one substitution that does most of the work: v is EXPOSURE, not
-- support. On IMDb "how many rated it" is roughly "how many saw it"; here
-- those diverge, and an option can sit at zero votes precisely because only
-- three people were ever shown it. So v becomes `reach` (ballots that could
-- have contained the option) and R becomes support/reach. Thin evidence is
-- pulled toward the poll's own mean C rather than toward zero.
--
-- That alone is not enough. IMDb's m is 1250 against a global mean well below
-- its Top-250 candidates, so shrinkage genuinely punishes low-vote titles.
-- A friend-group poll has a handful of ballots and a C computed from the same
-- few options being scored, so the pull toward C is weak — measured against a
-- real Postgres, a single unanimous voter on a brand-new option outranked
-- 3-of-5 on an original one, and 2-of-2 outranked 8-of-12. That is the
-- original unfairness inverted, not fixed.
--
-- So the score is the LOWER BOUND of the posterior rather than its mean:
-- treat (m*C + U) and (m*(1-C) + reach - U) as a Beta posterior and subtract
-- z standard deviations. Ranking by "how good is this at least" is what makes
-- sample size count — the same reasoning behind Reddit's confidence sort and
-- the Wilson bound. A late option still climbs as fast as people see it (5 of
-- 6 beats 5 of 12 outright), it just can't win the poll on one vote.
--
-- Note the algebra: (v/(v+m))*R + (m/(v+m))*C is identically
-- (m*C + U)/(m + reach), so the posterior mean below IS the IMDb formula —
-- the only addition is the z*sd penalty.
--
-- Property worth knowing when reading a diff of results: when no option was
-- added late, every option has identical reach, so the score is a strictly
-- increasing affine function of the raw count and single/multi ordering is
-- unchanged. The new maths only moves things when exposure actually differs.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- visible_from — when an option actually became votable. Not the same as
-- created_at: with `option_adds_need_approval` an option sits invisible
-- between creation and approval, and counting that window as "reached" would
-- bias against exactly the options this migration exists to protect.
-- Backfilled to created_at, which is the best history the existing schema
-- holds (there is no approved_at to recover).
-- ---------------------------------------------------------------------------
alter table poll_options add column visible_from timestamptz not null default now();
update poll_options set visible_from = created_at;

create or replace function approve_poll_option(p_option_id uuid)
returns poll_options
language plpgsql
security definer
set search_path = public
as $$
declare
  opt poll_options;
begin
  update poll_options po
  set approved = true,
      -- an option only becomes reachable now, not when it was submitted
      visible_from = now()
  from polls p
  where po.id = p_option_id
    and p.id = po.poll_id
    and p.author_id = auth.uid()
  returning po.* into opt;

  if opt.id is null then
    raise exception 'not found, or you are not this poll''s author';
  end if;

  return opt;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reach helpers. These have to be SECURITY DEFINER: the ballots SELECT policy
-- is `voter_id = auth.uid()` (0002_polls.sql), so an invoker-rights query can
-- only ever see its own ballot row and would compute a reach of 1 for
-- everything. They return aggregate counts only — never a voter identity, an
-- option choice, or a timestamp — so they leak strictly less than the vote
-- tallies get_poll_results already returns. Membership is checked explicitly,
-- following the can_read_ballot_entry convention from 0007.
--
-- Deliberately NOT gated on results_visibility: "how many people have voted"
-- says nothing about what anyone voted for, and it is the denominator that
-- makes every other number on the results panel interpretable.
-- ---------------------------------------------------------------------------
create function poll_ballot_count(p_poll_id uuid)
returns bigint
language sql
security definer
stable
set search_path = public
as $$
  select count(*)::bigint
  from ballots b
  where b.poll_id = p_poll_id
    and is_member((select p.group_id from polls p where p.id = p_poll_id));
$$;

create function poll_option_reach(p_poll_id uuid)
returns table(opt_id uuid, reach_count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select po.id,
         (select count(*)::bigint
            from ballots b
           where b.poll_id = p_poll_id
             -- updated_at, not created_at: cast_ballot bumps it on re-vote
             -- (0003_functions.sql), so someone who revised their ballot
             -- after the option appeared genuinely did see it.
             and b.updated_at >= po.visible_from)
  from poll_options po
  where po.poll_id = p_poll_id
    and po.approved
    and is_member((select p.group_id from polls p where p.id = p_poll_id));
$$;

-- ---------------------------------------------------------------------------
-- get_poll_turnout — poll-level denominator for the results header.
-- ---------------------------------------------------------------------------
create function get_poll_turnout(p_poll_id uuid)
returns table(ballots_cast bigint, group_size bigint)
language sql
security definer
stable
set search_path = public
as $$
  select
    -- bracket polls never create a ballots row (they record pairwise matchups
    -- instead), so counting ballots there would report a turnout of zero for
    -- a poll everyone has judged.
    case when p.type = 'bracket'
      then (select count(distinct mu.voter_id)::bigint from matchups mu where mu.poll_id = p.id)
      else poll_ballot_count(p.id)
    end,
    (select count(*)::bigint from group_members gm where gm.group_id = p.group_id)
  from polls p
  where p.id = p_poll_id
    and is_member(p.group_id);
$$;

-- ---------------------------------------------------------------------------
-- get_poll_results — same uniform shape across all four poll types, widened
-- with the numbers the results panel needs to show a ratio rather than a bare
-- count:
--
--   score    confidence-adjusted score; orders the list. Roughly 0..1 but
--            can go slightly negative for an option with almost no support,
--            so treat it as a sort key, not a percentage to display.
--   votes    unchanged meaning (= support), kept so nothing that reads only
--            this column changes behaviour
--   reach    how many ballots could have contained this option
--   support  how many of those actually picked it
--   raw      support/reach before shrinkage (null when reach = 0)
--   avg_rank mean finishing position, rank polls only (null otherwise)
--
-- Still INVOKER rights, deliberately: reading ballot_entries under the
-- caller's own RLS is what enforces results_visibility, so an after_vote poll
-- simply joins against nothing until you have voted. Only the reach
-- denominators come from the SECURITY DEFINER helpers above, because the
-- ballots table is invisible to everyone but its own voter. Do not collapse
-- this into a definer function — that would hand every group member the full
-- tally of a blind poll.
-- ---------------------------------------------------------------------------
drop function get_poll_results(uuid);

create function get_poll_results(p_poll_id uuid)
returns table(
  option_id uuid,
  label     text,
  image_url text,
  score     numeric,
  votes     bigint,
  reach     bigint,
  support   bigint,
  raw       numeric,
  avg_rank  numeric
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_type poll_type;
  v_m numeric;
  -- Standard deviations of penalty applied to thin evidence. 1.5 is the
  -- smallest value that keeps a 1-of-1 option below a 3-of-5 one and a 2-of-2
  -- below an 8-of-12, while still letting a genuinely popular late option win
  -- once roughly half the group has seen it. Raise it to be more conservative.
  v_z constant numeric := 1.5;
begin
  select p.type into v_type from polls p where p.id = p_poll_id;
  if v_type is null then
    return;
  end if;

  if v_type in ('single', 'multi', 'rank') then
    -- Prior weight: scales with the poll so a 40-person poll is not shrunk as
    -- hard as a 4-person one, but never reaches zero. Tuning this single
    -- coefficient is the whole dial on how conservative late options are.
    v_m := greatest(2, 0.25 * poll_ballot_count(p_poll_id));
  end if;

  if v_type in ('single', 'multi') then
    return query
    with rc as (
      select r.opt_id as o, r.reach_count as n from poll_option_reach(p_poll_id) r
    ),
    sp as (
      -- utility is 1 for a pick and 0 otherwise, so total utility = pick count
      select be.option_id as o, count(*)::bigint as s
      from ballot_entries be
      join poll_options po on po.id = be.option_id
      where po.poll_id = p_poll_id and po.approved
      group by be.option_id
    ),
    bs as (
      select po.id as o, po.label as lbl, po.image_url as img, po.position as pos,
             coalesce(rc.n, 0)::bigint as n,
             coalesce(sp.s, 0)::bigint as s
      from poll_options po
      left join rc on rc.o = po.id
      left join sp on sp.o = po.id
      where po.poll_id = p_poll_id and po.approved
    ),
    ag as (
      -- C: mean utility of an arbitrary (option, reaching ballot) pair. For a
      -- single-choice poll with M options this lands near 1/M, the right
      -- neutral expectation for an option nobody has judged yet.
      select case when sum(bs.n) > 0 then sum(bs.s)::numeric / sum(bs.n) else 0 end as c
      from bs
    ),
    sc as (
      select bs.o, bs.lbl, bs.img, bs.pos, bs.n, bs.s,
             case when bs.n > 0 then bs.s::numeric / bs.n else null end as rw,
             -- Beta posterior lower bound; alpha + beta simplifies to m + reach
             ((v_m * ag.c + bs.s) / (v_m + bs.n))
               - v_z * sqrt(
                   ((v_m * ag.c + bs.s) * (v_m * (1 - ag.c) + bs.n - bs.s))
                   / ((v_m + bs.n) * (v_m + bs.n) * (v_m + bs.n + 1))
                 ) as scr
      from bs cross join ag
    )
    select sc.o, sc.lbl, sc.img, sc.scr, sc.s, sc.n, sc.s, sc.rw, null::numeric
    from sc
    order by sc.scr desc, sc.pos asc;

  elsif v_type = 'rank' then
    return query
    with rc as (
      select r.opt_id as o, r.reach_count as n from poll_option_reach(p_poll_id) r
    ),
    kb as (
      -- how many options each ballot actually ranked. Normalising per ballot
      -- is what stops scores shifting when the option count changes, and what
      -- makes a 1st place worth 1.0 and the last ranked place worth 1/K
      -- however long the list is.
      select be.ballot_id as b, count(*)::numeric as k
      from ballot_entries be
      join poll_options po on po.id = be.option_id
      where po.poll_id = p_poll_id and po.approved and be.rank is not null
      group by be.ballot_id
    ),
    sp as (
      select be.option_id as o,
             sum((kb.k - be.rank + 1) / kb.k) as u,
             count(*)::bigint as s,
             avg(be.rank::numeric) as ark
      from ballot_entries be
      join poll_options po on po.id = be.option_id
      join kb on kb.b = be.ballot_id
      where po.poll_id = p_poll_id and po.approved and be.rank is not null
      group by be.option_id
    ),
    bs as (
      select po.id as o, po.label as lbl, po.image_url as img, po.position as pos,
             coalesce(rc.n, 0)::bigint as n,
             coalesce(sp.u, 0)::numeric as u,
             coalesce(sp.s, 0)::bigint as s,
             sp.ark as ark
      from poll_options po
      left join rc on rc.o = po.id
      left join sp on sp.o = po.id
      where po.poll_id = p_poll_id and po.approved
    ),
    ag as (
      select case when sum(bs.n) > 0 then sum(bs.u) / sum(bs.n) else 0 end as c
      from bs
    ),
    sc as (
      select bs.o, bs.lbl, bs.img, bs.pos, bs.n, bs.s, bs.ark,
             case when bs.n > 0 then bs.u / bs.n else null end as rw,
             ((v_m * ag.c + bs.u) / (v_m + bs.n))
               - v_z * sqrt(
                   ((v_m * ag.c + bs.u) * (v_m * (1 - ag.c) + bs.n - bs.u))
                   / ((v_m + bs.n) * (v_m + bs.n) * (v_m + bs.n + 1))
                 ) as scr
      from bs cross join ag
    )
    select sc.o, sc.lbl, sc.img, sc.scr, sc.s, sc.n, sc.s, sc.rw, round(sc.ark, 2)
    from sc
    order by sc.scr desc, sc.pos asc;

  elsif v_type = 'bracket' then
    -- Elo stays the ordering signal because it accounts for opponent
    -- strength, which a flat win rate does not. But a 2-match rating is noise
    -- presented as a number, so shrink it toward the 1500 seed by match count
    -- and express the result as the Elo expected score against an average
    -- option — "expected win rate vs the field", on the same 0..1 scale as the
    -- other poll types. That also fixes a display bug: every Elo clusters near
    -- 1500, so the old score/max bar rendered every option nearly full.
    return query
    with br as (
      select r.option_id as o, r.rating as rat, r.matches::bigint as n
      from bracket_ratings(p_poll_id) r
    ),
    pm as (
      select greatest(2, 0.25 * coalesce(avg(br.n), 0)) as m from br
    ),
    wn as (
      select mu.winner_option_id as o, count(*)::bigint as w
      from matchups mu
      where mu.poll_id = p_poll_id
      group by mu.winner_option_id
    ),
    sc as (
      select br.o, po.label as lbl, po.image_url as img, po.position as pos,
             br.n, coalesce(wn.w, 0)::bigint as s,
             case when br.n > 0 then coalesce(wn.w, 0)::numeric / br.n else null end as rw,
             1 / (1 + power(10,
               (1500 - (1500 + (br.n::numeric / (br.n + pm.m)) * (br.rat - 1500))) / 400
             )) as scr
      from br
      join poll_options po on po.id = br.o
      left join wn on wn.o = br.o
      cross join pm
    )
    select sc.o, sc.lbl, sc.img, sc.scr, sc.s, sc.n, sc.s, sc.rw, null::numeric
    from sc
    order by sc.scr desc, sc.pos asc;
  end if;
end;
$$;

-- Same lockdown as 0003. A dropped function loses its grants, so these have to
-- be reissued or get_poll_results becomes uncallable from the client.
revoke all on function poll_ballot_count(uuid) from public;
revoke all on function poll_option_reach(uuid) from public;
revoke all on function get_poll_turnout(uuid) from public;
revoke all on function get_poll_results(uuid) from public;

grant execute on function poll_ballot_count(uuid) to authenticated;
grant execute on function poll_option_reach(uuid) to authenticated;
grant execute on function get_poll_turnout(uuid) to authenticated;
grant execute on function get_poll_results(uuid) to authenticated;
