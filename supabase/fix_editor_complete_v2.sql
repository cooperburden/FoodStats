-- RUN THIS ENTIRE FILE in Supabase SQL Editor (fixes "view only" + meal inserts).
-- Does not use auth.users inside functions (often fails for RPC/RLS).

-- ---------------------------------------------------------------------------
-- Allow authenticated clients to verify editor status (small private app).
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated read editor allowlist" on public.editor_allowlist;
drop policy if exists "Public read editor emails for self" on public.editor_allowlist;
create policy "Authenticated read editor allowlist"
on public.editor_allowlist for select
to authenticated
using (true);

drop policy if exists "Read own editor id" on public.editor_allowlist_ids;
create policy "Read own editor id"
on public.editor_allowlist_ids for select
to authenticated
using (user_id = auth.uid());

grant select on public.editor_allowlist to authenticated;
grant select on public.editor_allowlist_ids to authenticated;

-- ---------------------------------------------------------------------------
-- is_editor(): JWT email + user_metadata email + UUID table (no auth.users)
-- ---------------------------------------------------------------------------
create or replace function public.is_editor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select
    exists (select 1 from public.editor_allowlist_ids i where i.user_id = auth.uid())
    or exists (
      select 1 from public.editor_allowlist e
      where lower(trim(e.email)) = lower(trim(coalesce(
        nullif(trim((auth.jwt() ->> 'email')::text), ''),
        nullif(trim((auth.jwt() -> 'user_metadata' ->> 'email')::text), ''),
        ''
      )))
    );
$$;

revoke all on function public.is_editor() from public;
grant execute on function public.is_editor() to authenticated;

-- ---------------------------------------------------------------------------
-- Meal writes: same logic inline (so inserts work even if RPC is weird)
-- ---------------------------------------------------------------------------
drop policy if exists "Editors insert meal entries" on public.meal_entries;
drop policy if exists "Editors update meal entries" on public.meal_entries;
drop policy if exists "Editors delete meal entries" on public.meal_entries;

create policy "Editors insert meal entries"
on public.meal_entries for insert
to authenticated
with check (
  exists (select 1 from public.editor_allowlist_ids i where i.user_id = auth.uid())
  or exists (
    select 1 from public.editor_allowlist e
    where lower(trim(e.email)) = lower(trim(coalesce(
      nullif(trim((auth.jwt() ->> 'email')::text), ''),
      nullif(trim((auth.jwt() -> 'user_metadata' ->> 'email')::text), ''),
      ''
    )))
  )
);

create policy "Editors update meal entries"
on public.meal_entries for update
to authenticated
using (
  exists (select 1 from public.editor_allowlist_ids i where i.user_id = auth.uid())
  or exists (
    select 1 from public.editor_allowlist e
    where lower(trim(e.email)) = lower(trim(coalesce(
      nullif(trim((auth.jwt() ->> 'email')::text), ''),
      nullif(trim((auth.jwt() -> 'user_metadata' ->> 'email')::text), ''),
      ''
    )))
  )
)
with check (
  exists (select 1 from public.editor_allowlist_ids i where i.user_id = auth.uid())
  or exists (
    select 1 from public.editor_allowlist e
    where lower(trim(e.email)) = lower(trim(coalesce(
      nullif(trim((auth.jwt() ->> 'email')::text), ''),
      nullif(trim((auth.jwt() -> 'user_metadata' ->> 'email')::text), ''),
      ''
    )))
  )
);

create policy "Editors delete meal entries"
on public.meal_entries for delete
to authenticated
using (
  exists (select 1 from public.editor_allowlist_ids i where i.user_id = auth.uid())
  or exists (
    select 1 from public.editor_allowlist e
    where lower(trim(e.email)) = lower(trim(coalesce(
      nullif(trim((auth.jwt() ->> 'email')::text), ''),
      nullif(trim((auth.jwt() -> 'user_metadata' ->> 'email')::text), ''),
      ''
    )))
  )
);

-- ---------------------------------------------------------------------------
-- Verify your Auth user id matches editor_allowlist_ids (run as postgres):
-- select id, email from auth.users where email ilike '%cooperburden%';
-- If id is not 3e103794-..., fix with:
-- delete from public.editor_allowlist_ids where user_id = '3e103794-451c-4adf-82f2-9d35db67ebcb';
-- insert into public.editor_allowlist_ids (user_id) values ('CORRECT-ID-HERE');
