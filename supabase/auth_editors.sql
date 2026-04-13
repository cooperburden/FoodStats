-- Run in Supabase SQL Editor after schema.sql + fix_anon_insert.sql.
-- Then add BOTH sign-in email addresses to editor_allowlist (exact match as stored by Auth).

create table if not exists public.editor_allowlist (
  email text primary key
);

alter table public.editor_allowlist enable row level security;

create table if not exists public.editor_allowlist_ids (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.editor_allowlist_ids enable row level security;

create or replace function public.is_editor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  with resolved as (
    select nullif(
      trim(
        lower(
          coalesce(
            (select u.email::text from auth.users u where u.id = auth.uid()),
            (auth.jwt() ->> 'email')::text,
            (auth.jwt() -> 'user_metadata' ->> 'email')::text,
            ''
          )
        )
      ),
      ''
    ) as em
  )
  select
    exists (
      select 1
      from public.editor_allowlist e, resolved r
      where r.em is not null
        and lower(trim(e.email)) = r.em
    )
    or exists (
      select 1 from public.editor_allowlist_ids i where i.user_id = auth.uid()
    );
$$;

revoke all on function public.is_editor() from public;
grant execute on function public.is_editor() to authenticated;

drop policy if exists "Authenticated write meal entries" on public.meal_entries;
drop policy if exists "Anon insert meal entries" on public.meal_entries;
drop policy if exists "Authenticated update meal entries" on public.meal_entries;
drop policy if exists "Authenticated delete meal entries" on public.meal_entries;

drop policy if exists "Editors insert meal entries" on public.meal_entries;
drop policy if exists "Editors update meal entries" on public.meal_entries;
drop policy if exists "Editors delete meal entries" on public.meal_entries;

create policy "Editors insert meal entries"
on public.meal_entries
for insert
to authenticated
with check (public.is_editor());

create policy "Editors update meal entries"
on public.meal_entries
for update
to authenticated
using (public.is_editor())
with check (public.is_editor());

create policy "Editors delete meal entries"
on public.meal_entries
for delete
to authenticated
using (public.is_editor());

-- Required: put the same emails you use in Supabase Auth magic links.
-- insert into public.editor_allowlist (email) values
--   ('cooper@yourdomain.com'),
--   ('tia@yourdomain.com');
