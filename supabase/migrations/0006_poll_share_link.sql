-- ============================================================================
-- 0006_poll_share_link.sql — preview a single poll via its group's invite
-- code, so a poll's direct share link (/p/[pollId]?code=...) can show who's
-- inviting you and to what before you join, without weakening the polls
-- SELECT policy (which requires membership). Mirrors
-- preview_group_by_code/join_group_by_code (0001/0003) — joining still goes
-- through join_group_by_code, this just proves the code matches this poll's
-- group first.
-- ============================================================================

create function preview_poll_by_code(p_poll_id uuid, p_code text)
returns table(question text, group_name text, group_slug text)
language sql
security definer
stable
set search_path = public
as $$
  select p.question, g.name, g.slug
  from polls p
  join groups g on g.id = p.group_id
  where p.id = p_poll_id and g.invite_code = p_code;
$$;

revoke all on function preview_poll_by_code(uuid, text) from public;
grant execute on function preview_poll_by_code(uuid, text) to authenticated;
