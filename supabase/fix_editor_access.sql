-- Run in Supabase SQL Editor if you’re allowlisted by email but still "view only"
-- or meal inserts fail RLS.
--
-- is_editor() uses: auth.users email → JWT email → user_metadata email, matched to
-- editor_allowlist; OR your User UID in editor_allowlist_ids (bulletproof).
--
-- Add yourself by UUID (Authentication → Users → copy User UID):
-- insert into public.editor_allowlist_ids (user_id) values ('YOUR-UUID-HERE')
-- on conflict do nothing;

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
