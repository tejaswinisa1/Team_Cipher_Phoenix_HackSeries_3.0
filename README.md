# DataDAO India

An agentic data-consent marketplace built on Algorand. Companies request access to user data, an AI policy engine evaluates and negotiates the price, consent proof is recorded on-chain, payment is settled separately, and a full audit trail is persisted in Supabase.

---

## What Is Built

| Capability | Status |
|---|---|
| Deterministic rule layer (price floor, sensitive types, premium threshold) | ✅ |
| LLM policy evaluation via Groq (uncertain cases, graceful fallback) | ✅ |
| AI Negotiation Engine (suggestedPrice + negotiationReasoning per decision) | ✅ |
| PyTeal ConsentContract on Algorand TestNet (App ID 758667150) | ✅ |
| On-chain consent proof (ApplicationCall, 5-field compact proof) | ✅ |
| Separate payment settlement (standalone PaymentTxn after proof) | ✅ |
| SHA-256 usage conditions hash linking on-chain and off-chain records | ✅ |
| Supabase audit trail (data_requests, agent_decisions, consent_records) | ✅ |
| human_reviewed mode (AI evaluates, human approves) | ✅ |
| agent_to_agent mode (AI evaluates and executes automatically) | ✅ |
| Compliance proof screen (4 sections: decision, proof, payment, audit) | ✅ |
| Personal Data Control Panel (per-type allow/restrict/block preferences) | ✅ |
| Data Value Analytics (avg price, total earnings, most valuable type) | ✅ |
| Recent Data Access Activity feed | ✅ |
| Pattern-based natural language query (no LLM) | ✅ |
| Payment provider abstraction (executePayment dispatch layer) | ✅ |

## What Is Not Implemented (Future Work)

| Capability | Notes |
|---|---|
| x402 HTTP payment protocol | Stub only — throws "not implemented" |
| User authentication | Wallet config stored in localStorage for this MVP |
| Multi-consent per request | One consent record per request |
| On-chain storage of all 9 consent fields | Compact 5-field proof only; full record in Supabase |

---

## Architecture

```
Browser (Next.js 14, port 3000)
  /              — landing page with live contract info
  /dashboard     — wallet config, request form, data control panel, analytics
  /request/[id]  — AI evaluation + negotiation panel + approve/reject
  /transaction/[id] — compliance proof screen (4 sections)
  /query         — natural language record search

Express API (Node.js, port 4000)
  POST /api/request-data          create DataRequest
  POST /api/request-data/auto     agent_to_agent: create + evaluate + execute
  POST /api/agent-decision        run policy engine, persist AgentDecision
  POST /api/execute-contract      run consentExecutionService (8-step flow)
  GET  /api/consent-records       list consent records
  GET  /api/analytics             data value analytics (global)
  GET  /api/earnings/:wallet      per-wallet earnings
  GET  /api/recent-activity/:wallet  recent consent records for a wallet
  GET  /api/data-preferences/:wallet  user data type preferences
  POST /api/data-preferences      save user preferences
  POST /api/query                 pattern-matched natural language query

Supabase Postgres
  data_requests, agent_decisions, consent_records, user_data_preferences

Algorand TestNet
  ConsentContract App ID: 758667150
  ApplicationCall (consent proof) + PaymentTxn (separate settlement)
```

---

## AI Policy Flow

```
policyEngine.evaluate(dataType, price, purpose, userPreferences)
  |
  +--> User preference check (before rules)
  |      blocked    → reject immediately [USER_BLOCKED]
  |      restricted → elevate riskLevel to high [USER_RESTRICTED]
  |
  +--> ruleLayer (synchronous, no I/O)
  |      price < 10 ALGO          → reject  [PRICE_BELOW_FLOOR]
  |      health / financial data  → reject  [SENSITIVE_DATA_TYPE]
  |      price > 100 ALGO         → approve [HIGH_VALUE_SAFE]
  |      else                     → escalate to LLM
  |
  +--> llmLayer (Groq, async, only if undecided)
  |      returns { decision, finalPrice, suggestedPrice,
  |                negotiationReasoning[], justification, confidence, riskLevel }
  |
  +--> fallback (if GROQ_API_KEY missing or LLM throws)
         price >= 20 ALGO → approve  [LLM_FALLBACK]
         else             → reject   [LLM_FALLBACK]
```

All thresholds are in `backend/agent/policyConfig.js`.

---

## Execution Flow (8 steps)

```
Step 1  Load DataRequest from Supabase
Step 2  Load AgentDecision (must exist — call POST /api/agent-decision first)
Step 3  Validate decision === 'approve'
Step 4  Compute usageConditionsHash (SHA-256 of canonical consent terms)
Step 5  ApplicationCall → ConsentContract.recordConsent (5 fields on-chain)
Step 6  PaymentTxn → company wallet → user wallet (separate transaction)
Step 7  Persist ConsentRecord to Supabase (links both tx IDs + hash)
Step 8  Return structured result with explorerUrls for both transactions
```

Steps 5 and 6 are separate transactions. If step 5 succeeds but step 6 fails, the consent proof is still valid on-chain and the partial result is returned.

---

## On-Chain Proof Design

The ConsentContract stores a compact 5-field proof in global state:

| Field | On-chain | Supabase |
|---|---|---|
| request_id | ✅ | ✅ |
| consent_status | ✅ | ✅ |
| price | ✅ | ✅ |
| usage_conditions_hash | ✅ | ✅ |
| timestamp | ✅ | ✅ |
| user_wallet | — | ✅ |
| company_wallet | — | ✅ |
| data_type | — | ✅ |
| purpose | — | ✅ |

The `usage_conditions_hash` is a SHA-256 of canonical JSON over all 9 fields. Anyone can recompute it from the Supabase record to verify the on-chain proof independently.

---

## Payment Provider Abstraction

```
executePayment(providerName, payload)
  |
  +--> 'algorandDirectPayment'  → executePaymentOnly()  [DEFAULT]
  |      standalone PaymentTxn, returns { paymentTxId, confirmedRound, explorerUrl }
  |
  +--> 'x402'                   → NotImplementedError (stub)
         future: HTTP-native machine-to-machine payments
         integration points marked with // x402-INTEGRATION: comments
```

To add a new provider: implement `execute(payload)` in `backend/payments/providers/` and register it in `executePayment.js`. No other file needs to change.

---

## Environment Variables

See `backend/.env.example` for annotated descriptions.

```
GROQ_API_KEY              # optional — fallback rules used if missing
ALGORAND_TOKEN            # use 64 'a' chars for public AlgoNode endpoint
ALGORAND_SERVER           # https://testnet-api.algonode.cloud
ALGORAND_PORT             # leave blank for AlgoNode
ALGORAND_APP_ID           # required — set after deploying the contract
SUPABASE_URL              # required — project URL from Supabase dashboard
SUPABASE_SERVICE_ROLE_KEY # required — service-role key (server-side only)
```

---

## Setup

### Prerequisites

- Node.js 18+
- Python 3.9+ (for contract deployment only)
- A funded Algorand TestNet wallet
- A Supabase project

### 1. Supabase

1. Create a project at https://supabase.com
2. SQL Editor → run `backend/db/migrations/001_initial_schema.sql`
3. SQL Editor → run `backend/db/migrations/004_user_data_preferences.sql`
4. Copy `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from Project Settings → API

### 2. Deploy the Algorand contract (skip if using existing App ID 758667150)

```bash
cd contracts
pip install -r requirements.txt
export DEPLOYER_MNEMONIC="word1 word2 ... word25"
python deploy.py
# Prints: ALGORAND_APP_ID=<id>
```

Fund the deployer wallet first at https://bank.testnet.algorand.network/

### 3. Backend

```bash
cd backend
cp .env.example .env
# Fill in all values
node server.js
# Running on http://localhost:4000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# Open http://localhost:3000
```

---

## Verify the Contract

```bash
python contracts/verify.py 758667150
```

Prints the 5 global state fields stored on-chain for the most recent consent.

---

## Demo Checklist

1. `GET http://localhost:4000/api/health` → `{ "success": true }`
2. Dashboard → save wallet config → submit request (location, 25 ALGO, "market research")
3. Request page → AI decision renders with confidence %, risk level, negotiation panel
4. Click "Accept AI Suggestion & Execute" → result page shows all 4 sections with real tx IDs
5. Click "Verify on Explorer" → Pera Wallet explorer confirms the transaction
6. Dashboard → toggle Agent-to-Agent → submit → redirects directly to result page
7. Dashboard → My Data Assets → toggle health to "blocked" → save → resubmit health request → auto-rejected
8. Dashboard → Data Value Analytics → shows per-type earnings table
9. Dashboard → Recent Activity → shows latest consent records
10. Query page → "latest consent transaction" → consent record card appears
11. `python contracts/verify.py 758667150` → prints 5 on-chain fields

---

## Project Structure

```
Team-cipher-pheonix-main/
├── backend/
│   ├── agent/
│   │   ├── policyConfig.js       thresholds + sensitive types
│   │   ├── ruleLayer.js          deterministic rules
│   │   ├── llmLayer.js           Groq LLM evaluation
│   │   └── policyEngine.js       aggregator: prefs → rules → LLM → fallback
│   ├── blockchain/
│   │   ├── algorandConsentService.js  ApplicationCall to ConsentContract
│   │   └── algorandService.js         facade (atomic group path)
│   ├── controllers/
│   │   ├── agentController.js
│   │   ├── contractController.js
│   │   ├── dataPreferencesController.js  preferences + earnings + analytics + activity
│   │   ├── queryController.js
│   │   └── requestController.js
│   ├── db/
│   │   ├── consentRepository.js
│   │   ├── decisionRepository.js
│   │   ├── requestRepository.js
│   │   ├── supabaseClient.js
│   │   └── migrations/
│   │       ├── 001_initial_schema.sql
│   │       ├── 002_add_missing_columns.sql
│   │       ├── 003_add_evaluated_by.sql
│   │       └── 004_user_data_preferences.sql
│   ├── payments/
│   │   ├── executePayment.js          provider dispatch
│   │   └── providers/
│   │       ├── algorandDirectPayment.js  ONLY file that imports algosdk
│   │       └── x402Provider.js           stub
│   ├── services/
│   │   ├── consentExecutionService.js  8-step orchestrator
│   │   └── queryService.js             pattern-matched query interpreter
│   ├── routes/api.js
│   └── server.js
├── contracts/
│   ├── consent_contract.py       PyTeal source (AVM 8)
│   ├── consent_contract_approval.teal
│   ├── consent_contract_clear.teal
│   ├── deploy.py                 deploy to TestNet
│   ├── verify.py                 read on-chain global state
│   └── requirements.txt
└── frontend/
    ├── app/
    │   ├── page.tsx              landing page
    │   ├── dashboard/page.tsx    control center
    │   ├── request/[id]/page.tsx AI evaluation + negotiation
    │   ├── transaction/[id]/page.tsx  compliance proof screen
    │   └── query/page.tsx        natural language search
    └── lib/
        └── api.ts                typed API client
```
