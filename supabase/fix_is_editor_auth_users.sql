-- Run in Supabase SQL Editor if is_editor() always returns false (view only) after login.
-- JWT email claim is not always present for RPC; use auth.users (canonical email).

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
