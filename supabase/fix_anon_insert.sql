-- Deprecated once you run auth_editors.sql (anon inserts are removed for security).
-- Run this in Supabase SQL Editor if you already ran schema.sql before anon insert was added.
-- Fixes: "new row violates row-level security policy" on insert when not logged in.

drop policy if exists "Anon insert meal entries" on public.meal_entries;
create policy "Anon insert meal entries"
on public.meal_entries
for insert
to anon
with check (true);
