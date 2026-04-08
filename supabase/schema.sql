create extension if not exists "pgcrypto";

-- Emails allowed to insert/update/delete meals (add rows after creating users).
create table if not exists public.editor_allowlist (
  email text primary key
);

alter table public.editor_allowlist enable row level security;

create table if not exists public.meal_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant text not null,
  location_name text not null,
  ordered_items text[] not null default '{}',
  ate_by text not null check (ate_by in ('cooper', 'tia', 'both')),
  eaten_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.meal_entries enable row level security;

create or replace function public.is_editor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from auth.users u
    inner join public.editor_allowlist e
      on lower(trim(u.email::text)) = lower(trim(e.email))
    where u.id = auth.uid()
  );
$$;

revoke all on function public.is_editor() from public;
grant execute on function public.is_editor() to authenticated;

drop policy if exists "Public read meal entries" on public.meal_entries;
create policy "Public read meal entries"
on public.meal_entries
for select
to anon, authenticated
using (true);

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

-- After first deploy, insert allowlisted emails (SQL Editor), e.g.:
-- insert into public.editor_allowlist (email) values ('a@b.com'), ('c@d.com');
