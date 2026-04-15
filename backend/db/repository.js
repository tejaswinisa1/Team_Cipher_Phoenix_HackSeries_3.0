/**
 * repository.js
 * Thin data-access layer over Supabase Postgres.
 * All methods throw on error so callers can handle uniformly.
 *
 * Tables (snake_case columns to match Postgres convention):
 *   data_requests
 *   agent_decisions
 *   consent_records
 */

const supabase = require('./supabaseClient');

// ── Helpers ───────────────────────────────────────────────────────────────────

function assertNoError({ data, error }, context) {
  if (error) throw new Error(`[DB:${context}] ${error.message}`);
  return data;
}

// ── data_requests ─────────────────────────────────────────────────────────────

async function insertRequest(request) {
  const row = {
    id:             request.id,
    company_name:   request.companyName,
    company_wallet: request.companyWallet,
    user_wallet:    request.userWallet,
    data_type:      request.dataType,
    purpose:        request.purpose,
    offered_price:  request.offeredPrice,
    mode:           request.mode,
    status:         request.status,
    created_at:     request.createdAt
  };
  const result = await supabase.from('data_requests').insert(row).select().single();
  return assertNoError(result, 'insertRequest');
}

async function findRequestById(id) {
  const result = await supabase
    .from('data_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const row = assertNoError(result, 'findRequestById');
  return row ? rowToRequest(row) : null;
}

async function getAllRequests() {
  const result = await supabase
    .from('data_requests')
    .select('*')
    .order('created_at', { ascending: false });
  return assertNoError(result, 'getAllRequests').map(rowToRequest);
}

async function updateRequestStatus(id, status) {
  const result = await supabase
    .from('data_requests')
    .update({ status })
    .eq('id', id);
  assertNoError(result, 'updateRequestStatus');
}

function rowToRequest(row) {
  return {
    id:           row.id,
    companyName:  row.company_name,
    companyWallet: row.company_wallet,
    userWallet:   row.user_wallet,
    dataType:     row.data_type,
    purpose:      row.purpose,
    offeredPrice: row.offered_price,
    mode:         row.mode,
    status:       row.status,
    createdAt:    row.created_at
  };
}

// ── agent_decisions ───────────────────────────────────────────────────────────

async function insertDecision(decision) {
  const row = {
    request_id:   decision.requestId,
    decision:     decision.decision,
    final_price:  decision.finalPrice,
    justification: decision.justification,
    confidence:   decision.confidence,
    risk_level:   decision.riskLevel,
    rule_triggers: decision.ruleTriggers,
    evaluated_by: decision.evaluatedBy,
    evaluated_at: decision.evaluatedAt
  };
  const result = await supabase.from('agent_decisions').insert(row).select().single();
  return assertNoError(result, 'insertDecision');
}

async function findDecisionByRequestId(requestId) {
  const result = await supabase
    .from('agent_decisions')
    .select('*')
    .eq('request_id', requestId)
    .order('evaluated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = assertNoError(result, 'findDecisionByRequestId');
  return row ? rowToDecision(row) : null;
}

function rowToDecision(row) {
  return {
    requestId:    row.request_id,
    decision:     row.decision,
    finalPrice:   row.final_price,
    justification: row.justification,
    confidence:   row.confidence,
    riskLevel:    row.risk_level,
    ruleTriggers: row.rule_triggers,
    evaluatedBy:  row.evaluated_by,
    evaluatedAt:  row.evaluated_at
  };
}

// ── consent_records ───────────────────────────────────────────────────────────

async function insertConsentRecord(record) {
  const row = {
    request_id:             record.requestId,
    user_wallet:            record.userWallet,
    company_wallet:         record.companyWallet,
    data_type:              record.dataType,
    purpose:                record.purpose,
    consent_status:         record.consentStatus,
    price:                  record.price,
    timestamp:              record.timestamp,
    usage_conditions_hash:  record.usageConditionsHash,
    algorand_app_id:        record.algorandAppId,
    app_call_tx_id:         record.appCallTxId,
    payment_tx_id:          record.paymentTxId,
    explorer_url:           record.explorerUrl
  };
  const result = await supabase.from('consent_records').insert(row).select().single();
  return assertNoError(result, 'insertConsentRecord');
}

async function findConsentRecordByPaymentTxId(paymentTxId) {
  const result = await supabase
    .from('consent_records')
    .select('*')
    .eq('payment_tx_id', paymentTxId)
    .maybeSingle();
  const row = assertNoError(result, 'findConsentRecordByPaymentTxId');
  return row ? rowToConsentRecord(row) : null;
}

async function getAllConsentRecords() {
  const result = await supabase
    .from('consent_records')
    .select('*')
    .order('timestamp', { ascending: false });
  return assertNoError(result, 'getAllConsentRecords').map(rowToConsentRecord);
}

function rowToConsentRecord(row) {
  return {
    requestId:            row.request_id,
    userWallet:           row.user_wallet,
    companyWallet:        row.company_wallet,
    dataType:             row.data_type,
    purpose:              row.purpose,
    consentStatus:        row.consent_status,
    price:                row.price,
    timestamp:            row.timestamp,
    usageConditionsHash:  row.usage_conditions_hash,
    algorandAppId:        row.algorand_app_id,
    appCallTxId:          row.app_call_tx_id,
    paymentTxId:          row.payment_tx_id,
    explorerUrl:          row.explorer_url
  };
}

module.exports = {
  insertRequest,
  findRequestById,
  getAllRequests,
  updateRequestStatus,
  insertDecision,
  findDecisionByRequestId,
  insertConsentRecord,
  findConsentRecordByPaymentTxId,
  getAllConsentRecords
};
