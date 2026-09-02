-- ============================================================================
-- 0004_realtime.sql — put the tables the Results panel needs to react to on
-- the Realtime publication. RLS still applies to the replication stream, so
-- a client only receives change events for rows it's allowed to select.
-- ============================================================================

alter publication supabase_realtime add table ballots;
alter publication supabase_realtime add table ballot_entries;
alter publication supabase_realtime add table matchups;
alter publication supabase_realtime add table poll_options;
