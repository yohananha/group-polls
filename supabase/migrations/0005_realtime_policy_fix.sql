-- ============================================================================
-- 0005_realtime_policy_fix.sql — Realtime's postgres_changes re-evaluates a
-- table's SELECT policy per changed row. A `using` clause that subqueries a
-- *different* table (as poll_options' and matchups' did, joining back to
-- polls to resolve group_id) can fail that per-row check silently: the
-- event just never reaches subscribers, even though the exact same query
-- run as a normal SELECT (e.g. on page load) works fine. ballots' policy
-- (`voter_id = auth.uid()`, no join) was never affected, which is why votes
-- already updated live while new options and bracket results didn't.
--
-- Fix: wrap the cross-table check in a SECURITY DEFINER function so the
-- policy body is a single call keyed off the row's own columns, not a raw
-- subquery/join against another table.
-- ============================================================================

create function poll_group_member(p_poll_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select is_member(group_id) from polls where id = p_poll_id;
$$;

drop policy "members can read options for polls in their group" on poll_options;
create policy "members can read options for polls in their group"
  on poll_options for select
  to authenticated
  using (poll_group_member(poll_id));

create function can_read_matchup(p_poll_id uuid, p_voter_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from polls p
    where p.id = p_poll_id
      and is_member(p.group_id)
      and (
        coalesce(p.settings->>'results_visibility', 'always') in ('always', 'after_vote')
        or p.status = 'closed'
        or p_voter_id = auth.uid()
      )
  );
$$;

drop policy "matchups follow the same visibility rule as ballot_entries" on matchups;
create policy "matchups follow the same visibility rule as ballot_entries"
  on matchups for select
  to authenticated
  using (can_read_matchup(poll_id, voter_id));

revoke all on function poll_group_member(uuid) from public;
revoke all on function can_read_matchup(uuid, uuid) from public;
grant execute on function poll_group_member(uuid) to authenticated;
grant execute on function can_read_matchup(uuid, uuid) to authenticated;
