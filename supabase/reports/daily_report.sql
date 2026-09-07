-- ============================================================================
-- daily_report.sql — daily activity report: new polls, votes cast, and
-- group/voter activity for a given day.
--
-- Run this in the Supabase Dashboard's SQL Editor (Project -> SQL Editor ->
-- New query), paste the whole file, and click Run. It runs as the
-- postgres/service role there, which is required: polls, ballots, and
-- ballot_entries all carry RLS policies scoped to auth.uid(), so a normal
-- client connection would only ever see one voter's own rows.
--
-- To change which day is reported, edit the date below, then re-run the
-- whole script. Defaults to yesterday (UTC).
-- ============================================================================

drop table if exists _report_params;
create temporary table _report_params as
select (current_date - 1)::date as report_date;   -- <-- edit this date to report on a different day

-- === Summary ===
select
  (select count(*) from groups        where created_at >= p.report_date and created_at < p.report_date + 1) as new_groups,
  (select count(*) from polls         where created_at >= p.report_date and created_at < p.report_date + 1) as new_polls,
  (select count(*) from poll_options  where created_at >= p.report_date and created_at < p.report_date + 1) as new_options_added,
  (select count(*) from ballots       where created_at >= p.report_date and created_at < p.report_date + 1) as votes_cast,
  (select count(distinct voter_id) from ballots
     where created_at >= p.report_date and created_at < p.report_date + 1)                                  as distinct_voters,
  (select count(*) from matchups      where created_at >= p.report_date and created_at < p.report_date + 1) as bracket_matchups_judged,
  (select count(*) from polls
     where status = 'closed' and closes_at >= p.report_date and closes_at < p.report_date + 1)              as polls_closed
from _report_params p;

-- === New polls created ===
select
  p.id,
  g.name          as group_name,
  pr.display_name as author,
  p.type,
  p.status,
  p.question,
  p.created_at,
  (select count(*) from poll_options po where po.poll_id = p.id) as option_count,
  (select count(*) from ballots b where b.poll_id = p.id)         as votes_so_far
from polls p
join groups g    on g.id = p.group_id
join profiles pr on pr.id = p.author_id
cross join _report_params rp
where p.created_at >= rp.report_date and p.created_at < rp.report_date + 1
order by p.created_at;

-- === Votes cast, by poll ===
select
  p.id              as poll_id,
  g.name            as group_name,
  p.question,
  p.type,
  count(b.id)       as votes_cast,
  min(b.created_at) as first_vote_at,
  max(b.created_at) as last_vote_at
from ballots b
join polls p  on p.id = b.poll_id
join groups g on g.id = p.group_id
cross join _report_params rp
where b.created_at >= rp.report_date and b.created_at < rp.report_date + 1
group by p.id, g.name, p.question, p.type
order by votes_cast desc;

-- === Most active groups (by votes cast) ===
select
  g.id                       as group_id,
  g.name                     as group_name,
  count(distinct p.id)       as polls_active,
  count(b.id)                as votes_cast,
  count(distinct b.voter_id) as distinct_voters
from ballots b
join polls p  on p.id = b.poll_id
join groups g on g.id = p.group_id
cross join _report_params rp
where b.created_at >= rp.report_date and b.created_at < rp.report_date + 1
group by g.id, g.name
order by votes_cast desc;

-- === Most active voters ===
select
  pr.id                      as voter_id,
  pr.display_name            as voter,
  count(b.id)                as votes_cast,
  count(distinct b.poll_id)  as polls_voted_in
from ballots b
join profiles pr on pr.id = b.voter_id
cross join _report_params rp
where b.created_at >= rp.report_date and b.created_at < rp.report_date + 1
group by pr.id, pr.display_name
order by votes_cast desc
limit 20;

-- === Polls closed ===
select
  p.id,
  g.name as group_name,
  p.question,
  p.type,
  p.closes_at,
  (select count(*) from ballots b where b.poll_id = p.id) as total_votes
from polls p
join groups g on g.id = p.group_id
cross join _report_params rp
where p.status = 'closed'
  and p.closes_at >= rp.report_date and p.closes_at < rp.report_date + 1
order by p.closes_at;

-- === Options awaiting approval ===
select
  po.id,
  p.question,
  g.name           as group_name,
  po.label,
  pr.display_name  as added_by,
  po.created_at
from poll_options po
join polls p     on p.id = po.poll_id
join groups g    on g.id = p.group_id
join profiles pr on pr.id = po.added_by
cross join _report_params rp
where po.approved = false
  and po.created_at >= rp.report_date and po.created_at < rp.report_date + 1
order by po.created_at;

drop table _report_params;
