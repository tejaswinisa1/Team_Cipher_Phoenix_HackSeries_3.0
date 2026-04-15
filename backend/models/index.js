'use strict';

/**
 * Domain model factories for DataDAO India.
 *
 * These are plain JS objects — no ORM, no classes.
 * They define the canonical shape of each domain entity used throughout
 * the backend. Repositories map between these objects and Supabase rows.
 *
 * Audit trail design:
 *   DataRequest     — captures the full intent of the company's request
 *   AgentDecision   — captures the AI policy engine's evaluation result
 *   ConsentRecord   — captures the final execution outcome, including both
 *                     on-chain tx IDs and the off-chain proof hash
 *
 * The on-chain contract stores only 5 compact proof fields (request_id,
 * consent_status, price, usage_conditions_hash, timestamp). The ConsentRecord
 * in Supabase stores the full context needed to reconstruct the complete
 * consent event, including wallets, data type, purpose, and both tx IDs.
 */

/**
 * DataRequest — a company's request to access user data.
 */
function createDataRequest({
  companyName = '',
  companyWallet = '',
  userWallet = '',
  dataType,
  purpose,
  offeredPrice,
  mode = 'human_reviewed'  // 'human_reviewed' | 'agent_to_agent'
}) {
  return {
    id:            `req_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    companyName,
    companyWallet,
    userWallet,
    dataType,
    purpose,
    offeredPrice,
    mode,
    status:        'pending',  // 'pending' | 'approve' | 'reject' | 'approved'
    createdAt:     new Date().toISOString()
  };
}

/**
 * AgentDecision — the policy engine's evaluation result for a DataRequest.
 * Persisted to Supabase so the full reasoning is auditable off-chain.
 */
function createAgentDecision({
  requestId,
  decision,       // 'approve' | 'reject'
  finalPrice,
  justification,
  confidence    = null,  // 0-100
  riskLevel     = null,  // 'low' | 'medium' | 'high'
  ruleTriggers  = [],    // rule names that fired, e.g. ['PRICE_BELOW_FLOOR']
  evaluatedBy            // 'rules' | 'ai' | 'fallback'
}) {
  return {
    requestId,
    decision,
    finalPrice,
    justification,
    confidence,
    riskLevel,
    ruleTriggers,
    evaluatedBy,
    evaluatedAt: new Date().toISOString()
  };
}

/**
 * ConsentRecord — the full audit record created after successful execution.
 *
 * This is the off-chain complement to the compact on-chain proof.
 * The on-chain contract stores: request_id, consent_status, price,
 * usage_conditions_hash, timestamp.
 * This record stores everything else needed to reconstruct the full event:
 * wallets, data type, purpose, both tx IDs, app ID, mode.
 *
 * The usage_conditions_hash links both records — it can be recomputed
 * from the fields here to verify the on-chain proof independently.
 */
function createConsentRecord({
  requestId,
  userWallet,
  companyWallet,
  dataType,
  purpose,
  consentStatus       = 'approved',
  price,
  timestamp           = null,
  usageConditionsHash = null,
  algorandAppId       = null,
  appCallTxId         = null,   // consent proof tx
  paymentTxId         = null,   // payment settlement tx
  explorerUrl         = null,   // primary explorer link (payment tx)
  mode                = null
}) {
  const ts = timestamp || new Date().toISOString();

  // Build explorer URL from paymentTxId if not explicitly provided
  const resolvedExplorerUrl = explorerUrl
    || (paymentTxId ? `https://testnet.explorer.perawallet.app/tx/${paymentTxId}` : null);

  return {
    requestId,
    userWallet,
    companyWallet,
    dataType,
    purpose,
    consentStatus,
    price,
    timestamp:          ts,
    usageConditionsHash,
    algorandAppId,
    appCallTxId,
    paymentTxId,
    explorerUrl:        resolvedExplorerUrl,
    mode
  };
}

module.exports = { createDataRequest, createAgentDecision, createConsentRecord };
