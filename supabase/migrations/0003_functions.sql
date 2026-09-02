-- ============================================================================
-- 0003_functions.sql — write paths (SECURITY DEFINER, validate settings
-- server-side) and read paths (invoker-rights, so RLS/results_visibility
-- applies automatically).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- join_group_by_code — the only way rows land in group_members for a regular
-- member. Runs as SECURITY DEFINER because group_members has no general
-- insert policy for non-admins (see 0001).
-- ---------------------------------------------------------------------------
create function join_group_by_code(p_code text)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g groups;
begin
  select * into g from groups where invite_code = p_code;
  if g.id is null then
    raise exception 'invalid invite code';
  end if;

  insert into group_members (group_id, user_id)
  values (g.id, auth.uid())
  on conflict (group_id, user_id) do nothing;

  return g;
end;
$$;

-- ---------------------------------------------------------------------------
-- preview_group_by_code — lets someone on the /join/[code] page see which
-- group they're about to join before they commit, without weakening the
-- groups SELECT policy (which requires membership). Only exposes name and a
-- headcount, never the full row.
-- ---------------------------------------------------------------------------
create function preview_group_by_code(p_code text)
returns table(name text, member_count bigint)
language sql
security definer
stable
set search_path = public
as $$
  select g.name, count(gm.user_id)
  from groups g
  left join group_members gm on gm.group_id = g.id
  where g.invite_code = p_code
  group by g.name;
$$;

-- ---------------------------------------------------------------------------
-- add_poll_option — enforces allow_option_adds / option_adds_need_approval
-- from the poll's settings jsonb. The poll author can always add options,
-- pre-approved.
-- ---------------------------------------------------------------------------
create function add_poll_option(p_poll_id uuid, p_label text, p_image_url text default null)
returns poll_options
language plpgsql
security definer
set search_path = public
as $$
declare
  p polls;
  opt poll_options;
  is_author boolean;
begin
  select * into p from polls where id = p_poll_id;
  if p.id is null then
    raise exception 'poll not found';
  end if;
  if not is_member(p.group_id) then
    raise exception 'not a member of this group';
  end if;
  if p.status <> 'open' then
    raise exception 'poll is closed';
  end if;

  is_author := (p.author_id = auth.uid());

  if not is_author and not coalesce((p.settings->>'allow_option_adds')::boolean, false) then
    raise exception 'this poll does not allow adding options';
  end if;

  insert into poll_options (poll_id, label, image_url, added_by, position, approved)
  values (
    p_poll_id, p_label, p_image_url, auth.uid(),
    (select coalesce(max(position), -1) + 1 from poll_options where poll_id = p_poll_id),
    is_author or not coalesce((p.settings->>'option_adds_need_approval')::boolean, false)
  )
  returning * into opt;

  return opt;
end;
$$;

create function approve_poll_option(p_option_id uuid)
returns poll_options
language plpgsql
security definer
set search_path = public
as $$
declare
  opt poll_options;
begin
  update poll_options po
  set approved = true
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
-- cast_ballot — single/multi/rank voting. Re-validates everything the UI
-- already enforces (min/max picks, top_n, allow_vote_change) so a hand-built
-- request can't bypass the poll's settings.
-- ---------------------------------------------------------------------------
create function cast_ballot(p_poll_id uuid, p_option_ids uuid[], p_ranks int[] default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  p polls;
  v_ballot ballots;
  v_settings jsonb;
  v_min int;
  v_max int;
  v_top_n int;
  i int;
begin
  select * into p from polls where id = p_poll_id;
  if p.id is null then
    raise exception 'poll not found';
  end if;
  if not is_member(p.group_id) then
    raise exception 'not a member of this group';
  end if;
  if p.status <> 'open' then
    raise exception 'poll is closed';
  end if;
  if p.type = 'bracket' then
    raise exception 'bracket polls are voted on via record_matchup, not cast_ballot';
  end if;
  if p_option_ids is null or array_length(p_option_ids, 1) is null then
    raise exception 'select at least one option';
  end if;

  v_settings := p.settings;

  if p.type = 'single' and array_length(p_option_ids, 1) <> 1 then
    raise exception 'a single-choice poll needs exactly one selected option';
  end if;

  if p.type = 'multi' then
    v_min := coalesce((v_settings->>'min_picks')::int, 1);
    v_max := coalesce((v_settings->>'max_picks')::int, 2147483647);
    if array_length(p_option_ids, 1) < v_min or array_length(p_option_ids, 1) > v_max then
      raise exception 'pick between % and % options', v_min, v_max;
    end if;
  end if;

  if p.type = 'rank' then
    v_top_n := (v_settings->>'top_n')::int;
    if v_top_n is not null and array_length(p_option_ids, 1) > v_top_n then
      raise exception 'rank at most % options', v_top_n;
    end if;
    if p_ranks is null or array_length(p_ranks, 1) <> array_length(p_option_ids, 1) then
      raise exception 'each ranked option needs a rank value';
    end if;
  end if;

  if exists (
    select 1 from unnest(p_option_ids) oid
    where not exists (select 1 from poll_options po where po.id = oid and po.poll_id = p_poll_id and po.approved)
  ) then
    raise exception 'one or more options are invalid for this poll';
  end if;

  select * into v_ballot from ballots where poll_id = p_poll_id and voter_id = auth.uid();

  if v_ballot.id is not null and not coalesce((v_settings->>'allow_vote_change')::boolean, false) then
    raise exception 'this poll does not allow changing your vote';
  end if;

  if v_ballot.id is null then
    insert into ballots (poll_id, voter_id) values (p_poll_id, auth.uid()) returning * into v_ballot;
  else
    update ballots set updated_at = now() where id = v_ballot.id;
    delete from ballot_entries where ballot_id = v_ballot.id;
  end if;

  for i in 1 .. array_length(p_option_ids, 1) loop
    insert into ballot_entries (ballot_id, option_id, rank)
    values (v_ballot.id, p_option_ids[i], case when p.type = 'rank' then p_ranks[i] else null end);
  end loop;

  return v_ballot.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- record_matchup — one head-to-head judgment in a bracket poll.
-- ---------------------------------------------------------------------------
create function record_matchup(p_poll_id uuid, p_option_a uuid, p_option_b uuid, p_winner uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  p polls;
  v_id uuid;
begin
  select * into p from polls where id = p_poll_id;
  if p.id is null or p.type <> 'bracket' then
    raise exception 'not a bracket poll';
  end if;
  if not is_member(p.group_id) then
    raise exception 'not a member of this group';
  end if;
  if p.status <> 'open' then
    raise exception 'poll is closed';
  end if;
  if p_winner not in (p_option_a, p_option_b) then
    raise exception 'winner must be one of the two options shown';
  end if;

  insert into matchups (poll_id, voter_id, option_a_id, option_b_id, winner_option_id)
  values (p_poll_id, auth.uid(), p_option_a, p_option_b, p_winner)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- bracket_ratings — replays a poll's matchups in order to produce live Elo
-- ratings. Pure computation over jsonb accumulators (no temp tables), so it
-- can run with invoker rights and stays covered by the matchups RLS policy.
-- K=32, everyone starts at 1500.
-- ---------------------------------------------------------------------------
create function bracket_ratings(p_poll_id uuid)
returns table(option_id uuid, rating numeric, matches int)
language plpgsql
stable
set search_path = public
as $$
declare
  ratings jsonb := '{}'::jsonb;
  counts  jsonb := '{}'::jsonb;
  k constant numeric := 32;
  opt record;
  m record;
  ra numeric;
  rb numeric;
  ea numeric;
  eb numeric;
  sa numeric;
  sb numeric;
begin
  for opt in select id from poll_options where poll_id = p_poll_id and approved loop
    ratings := jsonb_set(ratings, array[opt.id::text], to_jsonb(1500::numeric));
    counts  := jsonb_set(counts,  array[opt.id::text], to_jsonb(0));
  end loop;

  for m in
    select option_a_id, option_b_id, winner_option_id
    from matchups
    where poll_id = p_poll_id
    order by created_at asc
  loop
    ra := (ratings ->> m.option_a_id::text)::numeric;
    rb := (ratings ->> m.option_b_id::text)::numeric;

    if ra is null or rb is null then
      continue; -- option since removed/unapproved; skip stale matchup
    end if;

    ea := 1 / (1 + power(10, (rb - ra) / 400));
    eb := 1 - ea;

    if m.winner_option_id = m.option_a_id then sa := 1; sb := 0;
    else sa := 0; sb := 1;
    end if;

    ratings := jsonb_set(ratings, array[m.option_a_id::text], to_jsonb(ra + k * (sa - ea)));
    ratings := jsonb_set(ratings, array[m.option_b_id::text], to_jsonb(rb + k * (sb - eb)));
    counts  := jsonb_set(counts, array[m.option_a_id::text], to_jsonb(((counts ->> m.option_a_id::text)::int) + 1));
    counts  := jsonb_set(counts, array[m.option_b_id::text], to_jsonb(((counts ->> m.option_b_id::text)::int) + 1));
  end loop;

  return query
    select (t.key)::uuid, (t.value)::numeric, (counts ->> t.key)::int
    from jsonb_each_text(ratings) as t(key, value);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_next_matchup — for the calling voter, the pair with the fewest total
-- judgments so far (spreads coverage across options), tie-broken by closest
-- current rating (keeps matchups competitive), excluding any pair this voter
-- has already judged. Empty result means this voter has judged every pair.
-- ---------------------------------------------------------------------------
create function get_next_matchup(p_poll_id uuid)
returns table(option_a_id uuid, option_b_id uuid)
language plpgsql
stable
set search_path = public
as $$
declare
  v_voter uuid := auth.uid();
begin
  return query
  with ratings as (
    select * from bracket_ratings(p_poll_id)
  ),
  candidates as (
    select a.option_id as a_id, b.option_id as b_id,
           a.matches + b.matches as combined_matches,
           abs(a.rating - b.rating) as rating_gap
    from ratings a
    join ratings b on a.option_id < b.option_id
    where not exists (
      select 1 from matchups mu
      where mu.poll_id = p_poll_id
        and mu.voter_id = v_voter
        and ((mu.option_a_id = a.option_id and mu.option_b_id = b.option_id)
          or (mu.option_a_id = b.option_id and mu.option_b_id = a.option_id))
    )
  )
  select a_id, b_id
  from candidates
  order by combined_matches asc, rating_gap asc
  limit 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_poll_results — uniform (option_id, label, image_url, score, votes)
-- shape across all four poll types, so the Results component never branches
-- on type for data fetching, only for presentation. Deliberately INVOKER
-- rights (no security definer): it reads ballot_entries/matchups under the
-- caller's own RLS, which is what actually enforces results_visibility
-- ('after_vote' polls simply join against nothing until you've voted).
-- ---------------------------------------------------------------------------
create function get_poll_results(p_poll_id uuid)
returns table(option_id uuid, label text, image_url text, score numeric, votes bigint)
language plpgsql
stable
set search_path = public
as $$
declare
  v_type poll_type;
begin
  select type into v_type from polls where id = p_poll_id;

  if v_type in ('single', 'multi') then
    return query
      select po.id, po.label, po.image_url,
             count(be.ballot_id)::numeric as score,
             count(be.ballot_id) as votes
      from poll_options po
      left join ballot_entries be on be.option_id = po.id
      where po.poll_id = p_poll_id and po.approved
      group by po.id
      order by score desc, po.position asc;

  elsif v_type = 'rank' then
    return query
      select po.id, po.label, po.image_url,
             coalesce(sum(
               (select count(*) from poll_options where poll_id = p_poll_id and approved) - be.rank
             ), 0)::numeric as score,
             count(be.ballot_id) as votes
      from poll_options po
      left join ballot_entries be on be.option_id = po.id and be.rank is not null
      where po.poll_id = p_poll_id and po.approved
      group by po.id
      order by score desc, po.position asc;

  elsif v_type = 'bracket' then
    return query
      select r.option_id, po.label, po.image_url, round(r.rating)::numeric as score, r.matches::bigint as votes
      from bracket_ratings(p_poll_id) r
      join poll_options po on po.id = r.option_id
      order by r.rating desc;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- get_poll_voters — the other half of the `anonymous` setting: when a poll
-- isn't anonymous, this names who picked each option. Deliberately empty for
-- anonymous polls and for bracket polls (a stream of pairwise judgments
-- doesn't map onto "who voted for what" the way a ballot does). Invoker
-- rights, same reasoning as get_poll_results: it reads ballot_entries under
-- the caller's own RLS, so results_visibility is enforced for free.
-- ---------------------------------------------------------------------------
create function get_poll_voters(p_poll_id uuid)
returns table(option_id uuid, voter_name text)
language plpgsql
stable
set search_path = public
as $$
declare
  p polls;
begin
  select * into p from polls where id = p_poll_id;
  if p.id is null or p.type = 'bracket' or coalesce((p.settings->>'anonymous')::boolean, false) then
    return;
  end if;

  return query
    select be.option_id, pr.display_name
    from ballot_entries be
    join ballots b on b.id = be.ballot_id
    join profiles pr on pr.id = b.voter_id
    where b.poll_id = p_poll_id
    order by pr.display_name;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lock down execute grants: only signed-in users, never anon/PUBLIC. RLS
-- still protects the underlying rows even if a grant were missed, but no
-- reason to expose these to anon at all.
-- ---------------------------------------------------------------------------
revoke all on function preview_group_by_code(text) from public;
revoke all on function join_group_by_code(text) from public;
revoke all on function add_poll_option(uuid, text, text) from public;
revoke all on function approve_poll_option(uuid) from public;
revoke all on function cast_ballot(uuid, uuid[], int[]) from public;
revoke all on function record_matchup(uuid, uuid, uuid, uuid) from public;
revoke all on function bracket_ratings(uuid) from public;
revoke all on function get_next_matchup(uuid) from public;
revoke all on function get_poll_results(uuid) from public;
revoke all on function get_poll_voters(uuid) from public;

grant execute on function preview_group_by_code(text) to authenticated;
grant execute on function join_group_by_code(text) to authenticated;
grant execute on function add_poll_option(uuid, text, text) to authenticated;
grant execute on function approve_poll_option(uuid) to authenticated;
grant execute on function cast_ballot(uuid, uuid[], int[]) to authenticated;
grant execute on function record_matchup(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function bracket_ratings(uuid) to authenticated;
grant execute on function get_next_matchup(uuid) to authenticated;
grant execute on function get_poll_results(uuid) to authenticated;
grant execute on function get_poll_voters(uuid) to authenticated;
