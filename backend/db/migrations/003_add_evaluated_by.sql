-- Migration 003: add evaluated_by to agent_decisions
-- Run in Supabase SQL Editor if the table already exists without this column.

alter table agent_decisions
  add column if not exists evaluated_by text;

create index if not exists idx_consent_records_user_wallet
  on consent_records (user_wallet);
