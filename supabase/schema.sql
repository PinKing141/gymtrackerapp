create table if not exists public.gym_tracker_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.gym_tracker_data enable row level security;

drop policy if exists "Users can view their own gym data" on public.gym_tracker_data;
create policy "Users can view their own gym data"
on public.gym_tracker_data
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Users can insert their own gym data" on public.gym_tracker_data;
create policy "Users can insert their own gym data"
on public.gym_tracker_data
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update their own gym data" on public.gym_tracker_data;
create policy "Users can update their own gym data"
on public.gym_tracker_data
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
