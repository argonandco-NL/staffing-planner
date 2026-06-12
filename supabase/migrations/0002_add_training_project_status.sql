-- Add 'training' as a project status, alongside 'internal'/'non_billable'.
-- Run this in the Supabase SQL editor. Enum additions cannot run inside the
-- same transaction as other DDL, so this is a standalone migration.

alter type project_status add value if not exists 'training';
