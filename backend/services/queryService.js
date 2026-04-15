'use strict';

/**
 * queryService.js
 *
 * Lightweight natural-language query engine.
 * Uses pattern matching only — no LLM involved.
 * Each pattern maps to a repository call and returns a structured result.
 *
 * Response shape:
 *   { interpretedIntent, filters, results, resultType, count }
 *
 * resultType tells the frontend which card layout to use:
 *   'consent_records' | 'data_requests' | 'agent_decisions'
 *
 * ── Supported intents ──────────────────────────────────────────────────────
 *
 *  Intent                        Example query
 *  ─────────────────────────     ──────────────────────────────────────────
 *  LATEST_CONSENT                "latest consent transaction"
 *  LATEST_N_CONSENTS             "latest 5 consent transactions"
 *  ALL_CONSENTS                  "all transactions" / "all consent records"
 *  CONSENTS_BY_DATA_TYPE         "payments for location data"
 *  CONSENTS_BY_STATUS            "approved consent records"
 *  CONSENTS_BY_MODE              "agent_to_agent transactions"
 *  CONSENTS_BY_WALLET            "transactions for wallet ABCD..."
 *  REQUESTS_BY_STATUS            "show approved requests" / "rejected requests"
 *  REQUESTS_BY_DATA_TYPE         "requests for browsing data"
 *  ALL_REQUESTS                  "all requests"
 *  DECISIONS_BY_RISK             "high risk decisions"
 *  DECISIONS_BY_EVALUATOR        "decisions by ai" / "decisions by rules"
 *  ALL_DECISIONS                 "all decisions"
 *  UNKNOWN                       (no pattern matched)
 */

const requestRepository = require('../db/requestRepository');
const decisionRepository = require('../db/decisionRepository');
const consentRepository  = require('../db/consentRepository');

// ── Pattern table ─────────────────────────────────────────────────────────────
// Each entry: { regex, intent, handler(match) → Promise<result> }

const PATTERNS = [

  // ── Consent records ─────────────────────────────────────────────────────────

  {
    regex: /latest\s+(\d+)\s+(?:consent\s+)?transactions?/i,
    intent: 'LATEST_N_CONSENTS',
    handler: async (m) => {
      const limit = Math.min(parseInt(m[1], 10), 50);
      const results = await consentRepository.queryConsentRecords({ limit });
      return { intent: 'LATEST_N_CONSENTS', filters: { limit }, results, resultType: 'consent_records' };
    }
  },
  {
    regex: /latest\s+(?:consent\s+)?transaction/i,
    intent: 'LATEST_CONSENT',
    handler: async () => {
      const results = await consentRepository.queryConsentRecords({ limit: 1 });
      return { intent: 'LATEST_CONSENT', filters: { limit: 1 }, results, resultType: 'consent_records' };
    }
  },
  {
    regex: /(?:agent.?to.?agent|a2a)\s+transactions?/i,
    intent: 'CONSENTS_BY_MODE',
    handler: async () => {
      const results = await consentRepository.queryConsentRecords({ mode: 'agent_to_agent', limit: 20 });
      return { intent: 'CONSENTS_BY_MODE', filters: { mode: 'agent_to_agent' }, results, resultType: 'consent_records' };
    }
  },
  {
    regex: /human.?reviewed\s+transactions?/i,
    intent: 'CONSENTS_BY_MODE',
    handler: async () => {
      const results = await consentRepository.queryConsentRecords({ mode: 'human_reviewed', limit: 20 });
      return { intent: 'CONSENTS_BY_MODE', filters: { mode: 'human_reviewed' }, results, resultType: 'consent_records' };
    }
  },
  {
    regex: /(?:payments?|transactions?)\s+for\s+(\w+)/i,
    intent: 'CONSENTS_BY_DATA_TYPE',
    handler: async (m) => {
      const dataType = m[1].toLowerCase();
      const results = await consentRepository.queryConsentRecords({ dataType, limit: 20 });
      return { intent: 'CONSENTS_BY_DATA_TYPE', filters: { dataType }, results, resultType: 'consent_records' };
    }
  },
  {
    regex: /(?:transactions?|consent\s+records?)\s+for\s+(?:wallet\s+)?([A-Z2-7]{10,})/i,
    intent: 'CONSENTS_BY_WALLET',
    handler: async (m) => {
      const userWallet = m[1];
      const results = await consentRepository.queryConsentRecords({ userWallet, limit: 20 });
      return { intent: 'CONSENTS_BY_WALLET', filters: { userWallet }, results, resultType: 'consent_records' };
    }
  },
  {
    regex: /(approved|rejected)\s+(?:consent\s+)?records?/i,
    intent: 'CONSENTS_BY_STATUS',
    handler: async (m) => {
      const consentStatus = m[1].toLowerCase();
      const results = await consentRepository.queryConsentRecords({ consentStatus, limit: 20 });
      return { intent: 'CONSENTS_BY_STATUS', filters: { consentStatus }, results, resultType: 'consent_records' };
    }
  },
  {
    regex: /all\s+(?:consent\s+)?(?:transactions?|records?)/i,
    intent: 'ALL_CONSENTS',
    handler: async () => {
      const results = await consentRepository.queryConsentRecords({ limit: 50 });
      return { intent: 'ALL_CONSENTS', filters: {}, results, resultType: 'consent_records' };
    }
  },

  // ── Data requests ────────────────────────────────────────────────────────────

  {
    regex: /show\s+(approved|rejected|pending)\s+requests?/i,
    intent: 'REQUESTS_BY_STATUS',
    handler: async (m) => {
      const status = m[1].toLowerCase();
      const results = await requestRepository.listRequests({ status, limit: 20 });
      return { intent: 'REQUESTS_BY_STATUS', filters: { status }, results, resultType: 'data_requests' };
    }
  },
  {
    regex: /(approved|rejected|pending)\s+requests?/i,
    intent: 'REQUESTS_BY_STATUS',
    handler: async (m) => {
      const status = m[1].toLowerCase();
      const results = await requestRepository.listRequests({ status, limit: 20 });
      return { intent: 'REQUESTS_BY_STATUS', filters: { status }, results, resultType: 'data_requests' };
    }
  },
  {
    regex: /requests?\s+for\s+(\w+)/i,
    intent: 'REQUESTS_BY_DATA_TYPE',
    handler: async (m) => {
      const dataType = m[1].toLowerCase();
      // listRequests doesn't filter by dataType — use supabase directly via repo
      const all = await requestRepository.listRequests({ limit: 100 });
      const results = all.filter((r) => r.dataType === dataType);
      return { intent: 'REQUESTS_BY_DATA_TYPE', filters: { dataType }, results, resultType: 'data_requests' };
    }
  },
  {
    regex: /all\s+requests?/i,
    intent: 'ALL_REQUESTS',
    handler: async () => {
      const results = await requestRepository.listRequests({ limit: 50 });
      return { intent: 'ALL_REQUESTS', filters: {}, results, resultType: 'data_requests' };
    }
  },

  // ── Agent decisions ──────────────────────────────────────────────────────────

  {
    regex: /(high|medium|low)\s+risk\s+decisions?/i,
    intent: 'DECISIONS_BY_RISK',
    handler: async (m) => {
      const riskLevel = m[1].toLowerCase();
      const supabase = require('../db/supabaseClient');
      const { data, error } = await supabase
        .from('agent_decisions')
        .select('*')
        .eq('risk_level', riskLevel)
        .order('evaluated_at', { ascending: false })
        .limit(20);
      if (error) throw new Error(`[queryService] ${error.message}`);
      return { intent: 'DECISIONS_BY_RISK', filters: { riskLevel }, results: data ?? [], resultType: 'agent_decisions' };
    }
  },
  {
    regex: /decisions?\s+by\s+(ai|rules|fallback)/i,
    intent: 'DECISIONS_BY_EVALUATOR',
    handler: async (m) => {
      const evaluatedBy = m[1].toLowerCase();
      const supabase = require('../db/supabaseClient');
      const { data, error } = await supabase
        .from('agent_decisions')
        .select('*')
        .eq('evaluated_by', evaluatedBy)
        .order('evaluated_at', { ascending: false })
        .limit(20);
      if (error) throw new Error(`[queryService] ${error.message}`);
      return { intent: 'DECISIONS_BY_EVALUATOR', filters: { evaluatedBy }, results: data ?? [], resultType: 'agent_decisions' };
    }
  },
  {
    regex: /all\s+decisions?/i,
    intent: 'ALL_DECISIONS',
    handler: async () => {
      const supabase = require('../db/supabaseClient');
      const { data, error } = await supabase
        .from('agent_decisions')
        .select('*')
        .order('evaluated_at', { ascending: false })
        .limit(50);
      if (error) throw new Error(`[queryService] ${error.message}`);
      return { intent: 'ALL_DECISIONS', filters: {}, results: data ?? [], resultType: 'agent_decisions' };
    }
  },
];

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Interpret and execute a natural-language query.
 *
 * @param {string} rawQuery
 * @returns {Promise<{ interpretedIntent, filters, results, resultType, count }>}
 */
async function runQuery(rawQuery) {
  const q = rawQuery.trim();
  console.log(`[queryService] Query: "${q}"`);

  for (const { regex, handler } of PATTERNS) {
    const match = q.match(regex);
    if (match) {
      const result = await handler(match);
      console.log(`[queryService] Intent: ${result.intent}, results: ${result.results.length}`);
      return {
        interpretedIntent: result.intent,
        filters:           result.filters,
        results:           result.results,
        resultType:        result.resultType,
        count:             result.results.length
      };
    }
  }

  // No pattern matched
  const err = new Error(
    `Could not interpret query: "${q}". ` +
    `Try: "latest consent transaction", "approved requests", "payments for location data", ` +
    `"high risk decisions", "decisions by ai", "agent_to_agent transactions".`
  );
  err.statusCode = 400;
  throw err;
}

module.exports = { runQuery };
