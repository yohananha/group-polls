-- ============================================================================
-- 0009_fair_scoring_guard.sql — 0008's scoring could raise
-- "cannot take square root of a negative number" instead of returning rows.
--
-- The Beta lower bound computes beta = m*(1-C) + reach - U and feeds
-- alpha*beta to sqrt(). 0008 assumed U (support, or summed rank utility) can
-- never exceed `reach`, which holds whenever both come from the same caller's
-- view of the data. They don't: `reach` comes from the SECURITY DEFINER
-- helpers, which are gated on is_member() and return 0 when auth.uid() is
-- null, while U comes from ballot_entries read under the caller's own RLS.
-- Run get_poll_results from the Supabase SQL editor (role `postgres`, no JWT,
-- RLS bypassed) and you get reach = 0 with full support — beta goes negative
-- and the function throws. Reproduced on a 3-ballot rank poll.
--
-- Two changes, because the mismatch and the crash are separate faults:
--
-- 1. Return no rows unless the caller is a member. Previously a non-member's
--    result depended entirely on RLS, which meant a superuser caller silently
--    got a mix of real votes and zeroed denominators — numbers that look
--    plausible and are meaningless. An explicit guard is honest, and it makes
--    "query it in the SQL editor and read the numbers" fail loudly instead of
--    quietly lying. (Impersonate a member to inspect results by hand:
--    set local role authenticated; set local request.jwt.claims = '{"sub":"..."}';)
--
-- 2. Clamp the score arithmetic so it is total. U is clamped into [0, reach]
--    and C into [0, 1], and the sqrt argument is floored at 0. Support really
--    should never exceed reach, but a results panel that throws is far worse
--    than one that is slightly conservative, and there are edge cases the
--    invariant does not obviously survive — an option un-approved after it was
--    ranked leaves gaps in a ballot's rank sequence, which can already push a
--    single ballot's utility outside (0, 1].
--
-- Return type is unchanged, so this is a plain create-or-replace: no drop, and
-- the execute grant from 0008 carries over.
-- ============================================================================

create or replace function get_poll_results(p_poll_id uuid)
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
  v_group uuid;
  v_m numeric;
  v_z constant numeric := 1.5;
begin
  select p.type, p.group_id into v_type, v_group from polls p where p.id = p_poll_id;
  if v_type is null or not is_member(v_group) then
    return;
  end if;

  if v_type in ('single', 'multi', 'rank') then
    v_m := greatest(2, 0.25 * poll_ballot_count(p_poll_id));
  end if;

  if v_type in ('single', 'multi') then
    return query
    with rc as (
      select r.opt_id as o, r.reach_count as n from poll_option_reach(p_poll_id) r
    ),
    sp as (
      select be.option_id as o, count(*)::bigint as s
      from ballot_entries be
      join poll_options po on po.id = be.option_id
      where po.poll_id = p_poll_id and po.approved
      group by be.option_id
    ),
    bs as (
      select po.id as o, po.label as lbl, po.image_url as img, po.position as pos,
             coalesce(rc.n, 0)::bigint as n,
             coalesce(sp.s, 0)::bigint as s,
             -- support used for scoring, clamped into [0, reach] so the
             -- posterior's beta term can never go negative. The reported
             -- `support` column below stays unclamped: that is real data.
             greatest(0, least(coalesce(sp.s, 0), coalesce(rc.n, 0)))::numeric as se
      from poll_options po
      left join rc on rc.o = po.id
      left join sp on sp.o = po.id
      where po.poll_id = p_poll_id and po.approved
    ),
    ag as (
      select case when sum(bs.n) > 0
                  then least(greatest(sum(bs.se) / sum(bs.n), 0), 1)
                  else 0 end as c
      from bs
    ),
    sc as (
      select bs.o, bs.lbl, bs.img, bs.pos, bs.n, bs.s,
             case when bs.n > 0 then bs.s::numeric / bs.n else null end as rw,
             ((v_m * ag.c + bs.se) / (v_m + bs.n))
               - v_z * sqrt(greatest(0,
                   ((v_m * ag.c + bs.se) * (v_m * (1 - ag.c) + bs.n - bs.se))
                   / ((v_m + bs.n) * (v_m + bs.n) * (v_m + bs.n + 1))
                 )) as scr
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
             coalesce(sp.s, 0)::bigint as s,
             sp.ark as ark,
             greatest(0, least(coalesce(sp.u, 0), coalesce(rc.n, 0)::numeric)) as ue
      from poll_options po
      left join rc on rc.o = po.id
      left join sp on sp.o = po.id
      where po.poll_id = p_poll_id and po.approved
    ),
    ag as (
      select case when sum(bs.n) > 0
                  then least(greatest(sum(bs.ue) / sum(bs.n), 0), 1)
                  else 0 end as c
      from bs
    ),
    sc as (
      select bs.o, bs.lbl, bs.img, bs.pos, bs.n, bs.s, bs.ark,
             case when bs.n > 0 then bs.ue / bs.n else null end as rw,
             ((v_m * ag.c + bs.ue) / (v_m + bs.n))
               - v_z * sqrt(greatest(0,
                   ((v_m * ag.c + bs.ue) * (v_m * (1 - ag.c) + bs.n - bs.ue))
                   / ((v_m + bs.n) * (v_m + bs.n) * (v_m + bs.n + 1))
                 )) as scr
      from bs cross join ag
    )
    select sc.o, sc.lbl, sc.img, sc.scr, sc.s, sc.n, sc.s, sc.rw, round(sc.ark, 2)
    from sc
    order by sc.scr desc, sc.pos asc;

  elsif v_type = 'bracket' then
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
