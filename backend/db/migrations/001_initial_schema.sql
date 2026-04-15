-- =============================================================================
-- DataDAO India -- Supabase Postgres schema
-- Run once in: Supabase Dashboard -> SQL Editor -> New query -> Run
-- Safe to re-run: all statements use IF NOT EXISTS guards.
--
-- Audit trail design:
--   data_requests    — full intent of each company data-access request
--   agent_decisions  — full AI policy engine evaluation result
--   consent_records  — full execution outcome (off-chain complement to
--                      the compact 5-field on-chain proof)
--
-- The on-chain contract stores: request_id, consent_status, price,
-- usage_conditions_hash, timestamp.
-- These tables store everything else needed to reconstruct the full event.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. data_requests
--    One row per company data-access request.
--    Captures the full intent: who, what data, for what purpose, at what price.
-- ---------------------------------------------------------------------------

create table if not exists data_requests (
  id             text        primary key,           -- req_<timestamp>_<random>
  company_name   text        not null default '',
  company_wallet text        not null default '',
  user_wallet    text        not null default '',
  data_type      text        not null,              -- e.g. 'location', 'browsing'
  purpose        text        not null,
  offered_price  numeric     not null,
  mode           text        not null default 'human_reviewed',
  status         text        not null default 'pending',
  created_at     timestamptz not null default now()
);

create index if not exists idx_data_requests_created_at
  on data_requests (created_at desc);

create index if not exists idx_data_requests_status
  on data_requests (status);

create index if not exists idx_data_requests_user_wallet
  on data_requests (user_wallet);


-- ---------------------------------------------------------------------------
-- 2. agent_decisions
--    One row per policy engine evaluation.
--    Captures the full reasoning: decision, price, justification, confidence,
--    risk level, which rules fired, and whether AI or rules decided.
-- ---------------------------------------------------------------------------

create table if not exists agent_decisions (
  id            bigserial   primary key,
  request_id    text        not null references data_requests (id) on delete cascade,
  decision      text        not null,               -- 'approve' | 'reject'
  final_price   numeric     not null,
  justification text        not null,
  confidence    numeric,                            -- 0-100
  risk_level    text,                               -- 'low' | 'medium' | 'high'
  rule_triggers jsonb,                              -- e.g. ["PRICE_BELOW_FLOOR"]
  evaluated_by  text,                               -- 'rules' | 'ai' | 'fallback'
  evaluated_at  timestamptz not null default now()
);

create index if not exists idx_agent_decisions_request_id
  on agent_decisions (request_id);

create index if not exists idx_agent_decisions_decision
  on agent_decisions (decision);


-- ---------------------------------------------------------------------------
-- 3. consent_records
--    One row per successfully executed consent.
--    This is the off-chain audit complement to the compact on-chain proof.
--    The on-chain contract stores 5 fields; this table stores everything else.
--    The usage_conditions_hash links both records and can be independently
--    recomputed to verify the on-chain proof.
-- ---------------------------------------------------------------------------

create table if not exists consent_records (
  id                    bigserial   primary key,
  request_id            text        not null references data_requests (id) on delete cascade,
  user_wallet           text        not null,
  company_wallet        text        not null,
  data_type             text        not null,
  purpose               text        not null,
  consent_status        text        not null,       -- 'approved' | 'rejected'
  price                 numeric     not null,
  timestamp             timestamptz not null,       -- when consent was granted
  usage_conditions_hash text        not null,       -- SHA-256 proof hash
  algorand_app_id       text,                       -- ConsentContract app ID
  app_call_tx_id        text,                       -- consent proof tx
  payment_tx_id         text,                       -- payment settlement tx
  explorer_url          text,                       -- primary explorer link
  mode                  text,                       -- 'human_reviewed' | 'agent_to_agent'
  created_at            timestamptz not null default now()
);

create index if not exists idx_consent_records_request_id
  on consent_records (request_id);

create index if not exists idx_consent_records_consent_status
  on consent_records (consent_status);

create index if not exists idx_consent_records_created_at
  on consent_records (created_at desc);

create index if not exists idx_consent_records_user_wallet
  on consent_records (user_wallet);
