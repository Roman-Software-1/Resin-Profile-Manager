-- Run this in Supabase SQL Editor.
-- Creates one cloud profile row per authenticated user.

create table if not exists public.resinlab_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.resinlab_profiles enable row level security;

drop policy if exists "Users can read own resin profile" on public.resinlab_profiles;
create policy "Users can read own resin profile"
on public.resinlab_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "Users can insert own resin profile" on public.resinlab_profiles;
create policy "Users can insert own resin profile"
on public.resinlab_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "Users can update own resin profile" on public.resinlab_profiles;
create policy "Users can update own resin profile"
on public.resinlab_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete own resin profile" on public.resinlab_profiles;
create policy "Users can delete own resin profile"
on public.resinlab_profiles
for delete
to authenticated
using (auth.uid() = user_id);
