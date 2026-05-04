create table if not exists public.machine_distribution_snapshots (
  project_key text primary key,
  title text not null,
  payload jsonb not null,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.machine_distribution_snapshots enable row level security;

drop policy if exists "anon can read machine snapshots" on public.machine_distribution_snapshots;
create policy "anon can read machine snapshots"
on public.machine_distribution_snapshots
for select
to anon
using (true);

drop policy if exists "anon can insert machine snapshots" on public.machine_distribution_snapshots;
create policy "anon can insert machine snapshots"
on public.machine_distribution_snapshots
for insert
to anon
with check (true);

drop policy if exists "anon can update machine snapshots" on public.machine_distribution_snapshots;
create policy "anon can update machine snapshots"
on public.machine_distribution_snapshots
for update
to anon
using (true)
with check (true);

drop policy if exists "anon can delete machine snapshots" on public.machine_distribution_snapshots;
create policy "anon can delete machine snapshots"
on public.machine_distribution_snapshots
for delete
to anon
using (true);