-- User access management: roles, profiles, and related RLS.
-- Run this in the Supabase SQL editor after the base schema.sql.

-- -----------------------------------------------------------------------
-- Roles
-- -----------------------------------------------------------------------
create type user_role as enum ('user', 'admin', 'superadmin');

-- -----------------------------------------------------------------------
-- Profiles — one row per auth user, holds their role.
-- -----------------------------------------------------------------------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        user_role not null default 'user',
  person_id   uuid references people(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_profiles_updated_at before update on profiles
  for each row execute function update_updated_at();

-- -----------------------------------------------------------------------
-- Auto-create a profile row whenever a new auth user is created.
-- -----------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- -----------------------------------------------------------------------
-- Role helper functions (security definer avoids RLS recursion).
-- -----------------------------------------------------------------------
create or replace function public.is_admin() returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from public.profiles
      where id = auth.uid() and role in ('admin', 'superadmin')
    );
  $$;

create or replace function public.is_superadmin() returns boolean
  language sql security definer stable set search_path = public as $$
    select exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'superadmin'
    );
  $$;

-- -----------------------------------------------------------------------
-- Guard: never allow the last superadmin to be demoted.
-- -----------------------------------------------------------------------
create or replace function public.prevent_last_superadmin_demotion()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.role = 'superadmin' and new.role <> 'superadmin' then
    if (select count(*) from public.profiles where role = 'superadmin') <= 1 then
      raise exception 'Cannot remove the last superadmin';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_prevent_last_superadmin_demotion
  before update on profiles
  for each row execute function public.prevent_last_superadmin_demotion();

-- -----------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------
alter table profiles enable row level security;

create policy "read own profile" on profiles for select using (id = auth.uid());
create policy "admins read all profiles" on profiles for select using (public.is_admin());

-- Admins can update roles, but only a superadmin may grant or edit a superadmin row.
create policy "admins update roles" on profiles for update
  using (public.is_admin())
  with check (
    public.is_admin()
    and (role <> 'superadmin' or public.is_superadmin())
  );

-- -----------------------------------------------------------------------
-- Bootstrap: promote the first superadmin (run manually after signup).
-- -----------------------------------------------------------------------
-- update public.profiles set role = 'superadmin' where email = 'you@example.com';
