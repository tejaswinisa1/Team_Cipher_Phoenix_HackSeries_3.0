-- =============================================================================
-- Migration 004: user_data_preferences
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
--
-- Stores per-user data type preferences (allowed / restricted / blocked).
-- Keyed by user_wallet. Used by the Personal Data Control Panel on the
-- dashboard and by the policy engine to enforce user-level data controls.
-- =============================================================================

create table if not exists user_data_preferences (
  user_wallet  text        primary key,
  preferences  jsonb       not null default '{}',
  updated_at   timestamptz not null default now()
);

comment on table user_data_preferences is
  'Per-user data type preferences. preferences is a JSON object mapping
   data type names to "allowed" | "restricted" | "blocked".
   Example: {"location":"allowed","health":"blocked","financial":"blocked"}';

create index if not exists idx_user_data_preferences_updated_at
  on user_data_preferences (updated_at desc);
