-- ============================================================================
-- 0001_init.sql — profiles, groups, membership, and the core RLS helper
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per auth.users, created automatically on signup
-- ---------------------------------------------------------------------------
create table profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text not null,
  avatar_url    text,
  created_at    timestamptz not null default now()
);

alter table profiles enable row level security;

create policy "profiles are readable by any signed-in user"
  on profiles for select
  to authenticated
  using (true);

create policy "users can update their own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid());

-- Auto-create a profile row when someone signs up via Supabase Auth (Google OAuth
-- fills raw_user_meta_data with full_name / name and avatar_url / picture).
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- groups + group_members
-- ---------------------------------------------------------------------------
create table groups (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  slug         text not null unique,
  invite_code  text not null unique,
  created_by   uuid not null references profiles(id),
  created_at   timestamptz not null default now()
);

create type member_role as enum ('owner', 'admin', 'member');

create table group_members (
  group_id   uuid not null references groups(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  role       member_role not null default 'member',
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- SECURITY DEFINER helper — every RLS policy below calls this instead of
-- subquerying group_members directly. Writing the group_members policy as a
-- subquery over group_members causes infinite recursion in Postgres; this
-- function runs with elevated privileges and breaks that cycle. Get this
-- right once, reuse everywhere.
create function is_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create function is_admin(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid() and role in ('owner', 'admin')
  );
$$;

-- The group's creator becomes its owner automatically. This has to run as
-- SECURITY DEFINER: at the moment a group is inserted, group_members has no
-- rows for it yet, so the regular "owners can add members" insert policy
-- (is_admin(gid)) can't be satisfied by the creator themselves.
create function handle_new_group()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

create trigger on_group_created
  after insert on groups
  for each row execute function handle_new_group();

alter table groups enable row level security;
alter table group_members enable row level security;

create policy "members can read their group"
  on groups for select
  to authenticated
  using (is_member(id));

create policy "any signed-in user can create a group"
  on groups for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "members can read the membership list"
  on group_members for select
  to authenticated
  using (is_member(group_id));

-- Joining is done through the join_group_by_code() function (0003), which
-- runs as SECURITY DEFINER and validates the invite code — group_members has
-- no general-purpose insert policy for regular members.
create policy "owners can add members directly"
  on group_members for insert
  to authenticated
  with check (is_admin(group_id));

create policy "owners can remove members"
  on group_members for delete
  to authenticated
  using (is_admin(group_id) or user_id = auth.uid());
