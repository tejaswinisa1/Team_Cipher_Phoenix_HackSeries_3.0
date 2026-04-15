-- =============================================================================
-- Migration 002 -- Add missing columns to existing tables
-- Run in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run: uses IF NOT EXISTS guards
-- =============================================================================

-- Add created_at to data_requests if missing
alter table data_requests
  add column if not exists created_at timestamptz not null default now();

-- Add created_at index
create index if not exists idx_data_requests_created_at
  on data_requests (created_at desc);

-- Add decision index on agent_decisions
create index if not exists idx_agent_decisions_decision
  on agent_decisions (decision);

-- Add mode and created_at to consent_records if missing
alter table consent_records
  add column if not exists mode text;

alter table consent_records
  add column if not exists created_at timestamptz not null default now();

-- Add created_at index on consent_records
create index if not exists idx_consent_records_created_at
  on consent_records (created_at desc);

-- Add consent_status index on consent_records
create index if not exists idx_consent_records_consent_status
  on consent_records (consent_status);

-- Change rule_triggers from text[] to jsonb if it exists as text[]
-- (safe no-op if already jsonb or doesn't exist)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'agent_decisions'
      and column_name = 'rule_triggers'
      and data_type = 'ARRAY'
  ) then
    alter table agent_decisions
      alter column rule_triggers type jsonb using to_jsonb(rule_triggers);
  end if;
end $$;
