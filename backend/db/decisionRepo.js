/**
 * decisionRepo.js
 * Data-access for the agent_decisions table.
 */

const supabase = require('./supabaseClient');

// ── Row mapping ───────────────────────────────────────────────────────────────

function toRow(decision) {
  return {
    request_id:    decision.requestId,
    decision:      decision.decision,
    final_price:   decision.finalPrice,
    justification: decision.justification,
    confidence:    decision.confidence,
    risk_level:    decision.riskLevel,
    rule_triggers: decision.ruleTriggers,
    evaluated_by:  decision.evaluatedBy,
    evaluated_at:  decision.evaluatedAt
  };
}

function fromRow(row) {
  return {
    requestId:     row.request_id,
    decision:      row.decision,
    finalPrice:    row.final_price,
    justification: row.justification,
    confidence:    row.confidence,
    riskLevel:     row.risk_level,
    ruleTriggers:  row.rule_triggers,
    evaluatedBy:   row.evaluated_by,
    evaluatedAt:   row.evaluated_at
  };
}

function check({ data, error }, ctx) {
  if (error) throw new Error(`[decisionRepo:${ctx}] ${error.message}`);
  return data;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Persist an AgentDecision.
 * @param {object} decision — AgentDecision domain object
 * @returns {object} inserted row mapped back to domain shape
 */
async function saveDecision(decision) {
  const result = await supabase
    .from('agent_decisions')
    .insert(toRow(decision))
    .select()
    .single();
  return fromRow(check(result, 'saveDecision'));
}

/**
 * Fetch the most recent AgentDecision for a request.
 * @param {string} requestId
 * @returns {object|null}
 */
async function getDecision(requestId) {
  const result = await supabase
    .from('agent_decisions')
    .select('*')
    .eq('request_id', requestId)
    .order('evaluated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = check(result, 'getDecision');
  return row ? fromRow(row) : null;
}

module.exports = { saveDecision, getDecision };
