-- Staffing Planner — Supabase database schema
-- Run this in the Supabase SQL editor after creating your project.

-- PRIVACY: Do not include real client/project/employee names in migrations,
-- seed files, or schema comments committed to this repository.

-- -----------------------------------------------------------------------
-- Enable UUID extension
-- -----------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------
-- Enums
-- -----------------------------------------------------------------------
create type person_role as enum (
  'Partner', 'Associate Partner', 'Principal', 'Lead',
  'Senior Consultant', 'Consultant'
);

create type project_status as enum (
  'sold', 'planned', 'proposal', 'internal', 'non_billable'
);

create type project_priority as enum ('low', 'medium', 'high');

create type assignment_status as enum ('confirmed', 'tentative', 'proposed');

create type availability_exception_type as enum (
  'holiday', 'sick', 'training', 'other'
);

-- -----------------------------------------------------------------------
-- Tables
-- -----------------------------------------------------------------------

create table people (
  id                         uuid primary key default gen_random_uuid(),
  name                       text not null,
  role                       person_role not null,
  contract_days_per_week     numeric not null default 5,
  default_available_days_per_week numeric not null default 5,
  employment_start_date      date,
  employment_end_date        date,
  active                     boolean not null default true,
  color                      text,
  notes                      text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create table projects (
  id              uuid primary key default gen_random_uuid(),
  client_name     text not null,
  project_name    text not null,
  status          project_status not null,
  probability     integer not null default 100 check (probability between 0 and 100),
  start_date      date not null,
  end_date        date not null,
  owner_name      text,
  priority        project_priority not null default 'medium',
  billable        boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table project_demands (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  role_required   text not null,
  days_per_week   numeric not null,
  start_date      date not null,
  end_date        date not null,
  quantity        integer not null default 1 check (quantity > 0),
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table assignments (
  id                  uuid primary key default gen_random_uuid(),
  person_id           uuid not null references people(id) on delete cascade,
  project_id          uuid not null references projects(id) on delete cascade,
  project_demand_id   uuid references project_demands(id) on delete set null,
  assigned_role       text not null,
  start_date          date not null,
  end_date            date not null,
  days_per_week       numeric not null check (days_per_week > 0),
  status              assignment_status not null default 'confirmed',
  billable            boolean not null default true,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table availability_exceptions (
  id                         uuid primary key default gen_random_uuid(),
  person_id                  uuid not null references people(id) on delete cascade,
  start_date                 date not null,
  end_date                   date not null,
  unavailable_days_per_week  numeric not null check (unavailable_days_per_week > 0),
  type                       availability_exception_type not null,
  notes                      text,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create table staffing_notes (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid references projects(id) on delete cascade,
  person_id     uuid references people(id) on delete cascade,
  assignment_id uuid references assignments(id) on delete cascade,
  note          text not null,
  created_at    timestamptz not null default now(),
  created_by    text
);

create table import_batches (
  id            uuid primary key default gen_random_uuid(),
  type          text not null check (type in ('initial_projects', 'holidays')),
  file_name     text not null,
  imported_at   timestamptz not null default now(),
  imported_by   text,
  status        text not null,
  summary_json  jsonb
);

-- -----------------------------------------------------------------------
-- Updated-at trigger
-- -----------------------------------------------------------------------
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_people_updated_at before update on people
  for each row execute function update_updated_at();
create trigger trg_projects_updated_at before update on projects
  for each row execute function update_updated_at();
create trigger trg_demands_updated_at before update on project_demands
  for each row execute function update_updated_at();
create trigger trg_assignments_updated_at before update on assignments
  for each row execute function update_updated_at();
create trigger trg_exceptions_updated_at before update on availability_exceptions
  for each row execute function update_updated_at();

-- -----------------------------------------------------------------------
-- Row Level Security — all authenticated users can read and write
-- -----------------------------------------------------------------------
alter table people enable row level security;
alter table projects enable row level security;
alter table project_demands enable row level security;
alter table assignments enable row level security;
alter table availability_exceptions enable row level security;
alter table staffing_notes enable row level security;
alter table import_batches enable row level security;

-- Allow all operations for authenticated users
create policy "authenticated_all" on people for all to authenticated using (true) with check (true);
create policy "authenticated_all" on projects for all to authenticated using (true) with check (true);
create policy "authenticated_all" on project_demands for all to authenticated using (true) with check (true);
create policy "authenticated_all" on assignments for all to authenticated using (true) with check (true);
create policy "authenticated_all" on availability_exceptions for all to authenticated using (true) with check (true);
create policy "authenticated_all" on staffing_notes for all to authenticated using (true) with check (true);
create policy "authenticated_all" on import_batches for all to authenticated using (true) with check (true);
