-- Track whether a user has set their own password (vs. an admin-assigned one).
-- Run this in the Supabase SQL editor.
--
-- Defaults to false: admin-created accounts and admin-set passwords are NOT
-- self-set. It flips to true when the user changes their own password via
-- /account/change-password (see app/api/account/mark-password-self-set).

alter table public.profiles
  add column if not exists password_set_by_user boolean not null default false;
