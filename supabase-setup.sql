create table if not exists public.structure_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  model jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.structure_projects enable row level security;
create policy "owners read projects" on public.structure_projects for select using (auth.uid() = owner_id);
create policy "owners insert projects" on public.structure_projects for insert with check (auth.uid() = owner_id);
create policy "owners update projects" on public.structure_projects for update using (auth.uid() = owner_id);
create policy "owners delete projects" on public.structure_projects for delete using (auth.uid() = owner_id);
