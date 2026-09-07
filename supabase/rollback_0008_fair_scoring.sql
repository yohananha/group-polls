-- ============================================================================
-- 0008_fair_scoring_rollback.sql — undoes 0008_fair_scoring.sql.
--
-- NOT a migration. Do not apply this in sequence; it exists so 0008 (and the
-- 0009 fix on top of it) can be tried against a real project and backed out if
-- the new results look wrong. It undoes both: get_poll_results is dropped
-- outright, so it does not matter which version is currently installed.
-- Restores get_poll_results exactly as 0003_functions.sql defined it, drops
-- the helpers 0008 added, and removes poll_options.visible_from.
--
-- Nothing here loses data: visible_from is derived (it was backfilled from
-- created_at), and no ballot, option or matchup is touched. Re-applying 0008
-- afterwards is safe, with one caveat — visible_from is recreated from
-- created_at, so any option that was *approved* while 0008 was live loses its
-- true approval time and falls back to when it was submitted.
-- ============================================================================

drop function if exists get_poll_results(uuid);
drop function if exists get_poll_turnout(uuid);
drop function if exists poll_option_reach(uuid);
drop function if exists poll_ballot_count(uuid);

-- approve_poll_option, back to the 0003 version (no visible_from write)
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

alter table poll_options drop column if exists visible_from;

-- get_poll_results, verbatim from 0003_functions.sql
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

revoke all on function get_poll_results(uuid) from public;
grant execute on function get_poll_results(uuid) to authenticated;
