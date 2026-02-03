-- uc-confessions: full schema for Supabase
-- Run this in Supabase Dashboard → SQL Editor → New query

-- =============================================================================
-- 1. CONFESSIONS TABLE
-- =============================================================================
create table if not exists public.confessions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  body text not null,
  school_id text not null default 'ucr' check (school_id in (
    'ucr', 'ucla', 'ucsd', 'uci', 'ucb', 'ucd', 'ucsb', 'ucsc'
  )),
  views_count integer not null default 0,
  likes_count integer not null default 0
);

-- Index for feed: newest first, and for pagination
create index if not exists confessions_created_at_desc
  on public.confessions (created_at desc);

-- Index for filtering by school (e.g. map counts, feed filter)
create index if not exists confessions_school_id
  on public.confessions (school_id);

-- Optional: allow anonymous inserts/selects (adjust RLS to your needs)
alter table public.confessions enable row level security;

-- Policy: anyone can read confessions
create policy "confessions_select"
  on public.confessions for select
  using (true);

-- Policy: anyone can insert (anonymous confessions)
create policy "confessions_insert"
  on public.confessions for insert
  with check (true);

-- Policy: allow update only for likes_count / views_count (handled by RPC or service role)
create policy "confessions_update"
  on public.confessions for update
  using (true)
  with check (true);

-- =============================================================================
-- 2. RPC: INCREMENT VIEWS (once per session is enforced in app)
-- =============================================================================
create or replace function public.increment_confession_views(p_confession_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.confessions
  set views_count = views_count + 1
  where id = p_confession_id;
end;
$$;

-- Grant execute to anon and authenticated
grant execute on function public.increment_confession_views(uuid) to anon;
grant execute on function public.increment_confession_views(uuid) to authenticated;

-- =============================================================================
-- 3. RPC: INCREMENT LIKES (delta can be +1 or -1)
-- =============================================================================
create or replace function public.increment_confession_likes(
  p_confession_id uuid,
  p_delta integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.confessions
  set likes_count = greatest(0, likes_count + p_delta)
  where id = p_confession_id;
end;
$$;

grant execute on function public.increment_confession_likes(uuid, integer) to anon;
grant execute on function public.increment_confession_likes(uuid, integer) to authenticated;

-- =============================================================================
-- DONE
-- =============================================================================
-- After running:
-- 1. Confessions table is ready for insert/select/update.
-- 2. Map/counts API can use: select school_id from confessions.
-- 3. App can call increment_confession_views(id) and increment_confession_likes(id, delta).
