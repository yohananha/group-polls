-- ============================================================================
-- 0007_ballot_entries_policy_fix.sql — ballot_entries' SELECT policy has the
-- same shape 0005 already fixed for poll_options and matchups: a `using`
-- clause that joins back to `polls` to resolve group_id and settings. 0005
-- only chased that pattern down for the two tables whose Realtime events
-- were visibly failing; ballot_entries has the identical join and was never
-- touched, and it turns out the same failure mode isn't Realtime-specific —
-- a normal authenticated SELECT (e.g. get_poll_results, invoker rights) hits
-- it too, silently returning only the caller's own row instead of every
-- row 'always'-visibility should allow. Confirmed by impersonating a real
-- voter: the RLS-scoped query saw only their own ballot's entries, while the
-- identical query run as postgres (bypassing RLS) saw everyone's.
--
-- Fix: same as 0005 — wrap the cross-table check in a SECURITY DEFINER
-- function so the policy body is a single call keyed off the row's own
-- ballot_id, not a raw subquery/join against another table.
-- ============================================================================

create function can_read_ballot_entry(p_ballot_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from ballots b
    join polls p on p.id = b.poll_id
    where b.id = p_ballot_id
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
        or b.voter_id = auth.uid()
      )
  );
$$;

drop policy "read ballot_entries per poll's results_visibility" on ballot_entries;
create policy "read ballot_entries per poll's results_visibility"
  on ballot_entries for select
  to authenticated
  using (can_read_ballot_entry(ballot_id));

revoke all on function can_read_ballot_entry(uuid) from public;
grant execute on function can_read_ballot_entry(uuid) to authenticated;
