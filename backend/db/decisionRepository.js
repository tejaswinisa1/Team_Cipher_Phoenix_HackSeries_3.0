'use strict';

/**
 * decisionRepository.js
 *
 * All Supabase access for the agent_decisions table.
 * Returns normalized domain objects — no raw rows leave this module.
 *
 * Audit trail role:
 *   Each row captures the full AI policy engine evaluation for a request:
 *   decision, final price, justification, confidence, risk level, which
 *   rules fired, and whether the decision came from rules, AI, or fallback.
 *   This allows the full reasoning to be audited and queried off-chain.
 */

const supabase = require('./supabaseClient');

// ── Row mapping ───────────────────────────────────────────────────────────────

function toRow(d) {
  return {
    request_id:    d.requestId,
    decision:      d.decision,
    final_price:   d.finalPrice,
    justification: d.justification,
    confidence:    d.confidence    ?? null,
    risk_level:    d.riskLevel     ?? null,
    rule_triggers: d.ruleTriggers  ?? null,  // jsonb
    evaluated_by:  d.evaluatedBy   ?? null,  // 'rules' | 'ai' | 'fallback'
    evaluated_at:  d.evaluatedAt   || new Date().toISOString()
  };
}

function fromRow(row) {
  return {
    id:            row.id,
    requestId:     row.request_id,
    decision:      row.decision,
    finalPrice:    Number(row.final_price),
    justification: row.justification,
    confidence:    row.confidence != null ? Number(row.confidence) : null,
    riskLevel:     row.risk_level,
    ruleTriggers:  row.rule_triggers,
    evaluatedBy:   row.evaluated_by,
    evaluatedAt:   row.evaluated_at
  };
}

function assert({ data, error }, ctx) {
  if (error) throw new Error(`[decisionRepository:${ctx}] ${error.message}`);
  return data;
}

// ── Methods ───────────────────────────────────────────────────────────────────

/**
 * Persist an AgentDecision.
 * @param {object} decision
 * @returns {object} normalized domain object
 */
async function saveDecision(decision) {
  const result = await supabase
    .from('agent_decisions')
    .insert(toRow(decision))
    .select()
    .single();
  return fromRow(assert(result, 'saveDecision'));
}

/**
 * Fetch the most recent AgentDecision for a request.
 * @param {string} requestId
 * @returns {object|null}
 */
async function getDecisionByRequestId(requestId) {
  const result = await supabase
    .from('agent_decisions')
    .select('*')
    .eq('request_id', requestId)
    .order('evaluated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = assert(result, 'getDecisionByRequestId');
  return row ? fromRow(row) : null;
}

module.exports = { saveDecision, getDecisionByRequestId };
