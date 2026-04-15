'use strict';

/**
 * consentExecutionService.js
 *
 * Orchestrates the full approved-consent execution flow.
 * Consent proof and payment are EXPLICITLY SEPARATE steps — this is
 * intentional and visible in both the execution order and the response shape.
 *
 * Execution order:
 *   1. Load DataRequest
 *   2. Load AgentDecision (must exist and be 'approve')
 *   3. Validate decision is 'approve'
 *   4. Compute usageConditionsHash (canonical SHA-256)
 *   5. Record consent proof on-chain  ← ApplicationCall to ConsentContract
 *   6. Execute payment on-chain       ← separate Payment transaction
 *   7. Persist ConsentRecord to Supabase
 *   8. Return structured result
 *
 * Steps 5 and 6 are separate transactions with separate tx IDs.
 * If step 5 succeeds but step 6 fails, the consent proof is still on-chain
 * and the partial result is returned so the caller can surface it.
 *
 * Response shape:
 *   {
 *     requestId, mode, decision, finalPrice,
 *     consentRecorded,   ← true if app call confirmed
 *     paymentExecuted,   ← true if payment confirmed
 *     algorandAppId,
 *     appCallTxId,       ← consent proof tx
 *     paymentTxId,       ← payment settlement tx
 *     usageConditionsHash,
 *     explorerUrls: { appCall, payment },
 *     timestamp
 *   }
 */

const algorandConsentService          = require('../blockchain/algorandConsentService');
const { executePayment, DEFAULT_PROVIDER } = require('../payments/executePayment');
const { createConsentRecord }         = require('../models');
const { createAgentDecision }         = require('../models');
const { computeUsageConditionsHash }  = require('../utils/hashUtils');
const policyEngine                    = require('../agent/policyEngine');
const requestRepo                     = require('../db/requestRepository');
const decisionRepo                    = require('../db/decisionRepository');
const consentRepo                     = require('../db/consentRepository');

const EXPLORER_BASE = 'https://testnet.explorer.perawallet.app';

// ── executeConsent ─────────────────────────────────────────────────────────────

/**
 * Execute the full approved-consent flow for a human_reviewed request.
 * The agent decision must already exist in the DB before calling this.
 *
 * @param {object} params
 * @param {string} params.requestId
 * @param {string} params.userWallet
 * @param {string} params.companyWallet
 * @param {string} params.companyMnemonic
 * @param {number} params.amount
 * @returns {Promise<object>} structured result
 */
async function executeConsent({ requestId, userWallet, companyWallet, companyMnemonic, amount }) {
  console.log(`[consentExecutionService] ── Starting execution for request: ${requestId}`);

  // ── Step 1: Load request ───────────────────────────────────────────────────
  const request = await requestRepo.getRequestById(requestId);
  if (!request) {
    const err = new Error(`Request not found: ${requestId}`);
    err.statusCode = 404;
    throw err;
  }
  console.log(`[consentExecutionService] Step 1: Request loaded — ${request.dataType} / mode: ${request.mode}`);

  // ── Step 2: Load agent decision ────────────────────────────────────────────
  const agentDecision = await decisionRepo.getDecisionByRequestId(requestId);
  if (!agentDecision) {
    const err = new Error(
      `No agent decision for request ${requestId}. Call POST /api/agent-decision first.`
    );
    err.statusCode = 400;
    throw err;
  }
  console.log(`[consentExecutionService] Step 2: Decision loaded — ${agentDecision.decision} (by ${agentDecision.evaluatedBy})`);

  // ── Step 3: Validate decision ──────────────────────────────────────────────
  if (agentDecision.decision !== 'approve') {
    const err = new Error(
      `Cannot execute — request ${requestId} was not approved (decision: ${agentDecision.decision})`
    );
    err.statusCode = 400;
    throw err;
  }
  console.log(`[consentExecutionService] Step 3: Decision validated — approved`);

  const timestamp  = new Date().toISOString();
  const finalPrice = agentDecision.finalPrice ?? amount;

  // ── Step 4: Compute usageConditionsHash ───────────────────────────────────
  const usageConditionsHash = computeUsageConditionsHash({
    requestId,
    userWallet,
    companyWallet,
    dataType:  request.dataType,
    purpose:   request.purpose,
    price:     finalPrice,
    decision:  agentDecision.decision,
    timestamp,
  });
  console.log(`[consentExecutionService] Step 4: usageConditionsHash computed — ${usageConditionsHash.slice(0, 16)}...`);

  // ── Step 5: Record consent proof on-chain (ApplicationCall) ───────────────
  // This is the consent proof step — separate from payment.
  // Calls ConsentContract.recordConsent with 5 compact proof fields.
  let consentProof = null;
  let consentRecorded = false;

  try {
    console.log(`[consentExecutionService] Step 5: Recording consent proof on-chain...`);
    consentProof = await algorandConsentService.recordConsentOnChain({
      signerMnemonic:      companyMnemonic,
      requestId,
      userWallet,
      companyWallet,
      dataType:            request.dataType,
      purpose:             request.purpose,
      consentStatus:       'approved',
      price:               finalPrice,
      timestamp,
      usageConditionsHash,
    });
    consentRecorded = true;
    console.log(`[consentExecutionService] Step 5: Consent proof confirmed — appCallTxId: ${consentProof.appCallTxId}`);
  } catch (consentErr) {
    console.error(`[consentExecutionService] Step 5 FAILED: ${consentErr.message}`);
    const err = new Error(`Consent proof recording failed: ${consentErr.message}`);
    err.statusCode = 502;
    err.partial = { requestId, usageConditionsHash, consentRecorded: false, paymentExecuted: false, timestamp };
    throw err;
  }

  // ── Step 6: Execute payment (separate Payment transaction) ─────────────────
  // Payment is settled AFTER consent proof is confirmed on-chain.
  // These are two distinct transactions with distinct tx IDs.
  let paymentResult = null;
  let paymentExecuted = false;

  try {
    console.log(`[consentExecutionService] Step 6: Executing payment settlement — ${finalPrice} ALGO to ${userWallet}`);
    paymentResult = await executePayment(DEFAULT_PROVIDER, {
      signerMnemonic: companyMnemonic,
      toAddress:      userWallet,
      amount:         finalPrice,
      note:           JSON.stringify({
        requestId,
        consentStatus: 'approved',
        appCallTxId:   consentProof.appCallTxId,
        algorandAppId: consentProof.algorandAppId,
      }),
    });
    paymentExecuted = true;
    console.log(`[consentExecutionService] Step 6: Payment confirmed — paymentTxId: ${paymentResult.paymentTxId}`);
  } catch (paymentErr) {
    // Payment failed AFTER consent was recorded — surface partial result
    console.error(`[consentExecutionService] Step 6 FAILED: ${paymentErr.message}`);
    console.error(`[consentExecutionService] Consent proof is still valid on-chain: ${consentProof.appCallTxId}`);
    // Fall through to persist what we have and return partial result
  }

  // ── Step 7: Persist ConsentRecord ─────────────────────────────────────────
  // Pass the same timestamp used for the hash — ensures the DB record and
  // the on-chain proof are linked by an identical timestamp value.
  const record = createConsentRecord({
    requestId,
    userWallet,
    companyWallet,
    dataType:            request.dataType,
    purpose:             request.purpose,
    consentStatus:       'approved',
    price:               finalPrice,
    timestamp,
    usageConditionsHash,
    algorandAppId:       String(consentProof.algorandAppId),
    appCallTxId:         consentProof.appCallTxId,
    paymentTxId:         paymentResult?.paymentTxId ?? null,
    mode:                request.mode,
  });

  try {
    await consentRepo.saveConsentRecord(record);
    await requestRepo.updateStatus(requestId, 'approved');
    console.log(`[consentExecutionService] Step 7: ConsentRecord persisted to Supabase`);
  } catch (dbErr) {
    console.error(`[consentExecutionService] Step 7 FAILED (DB): ${dbErr.message}`);
    console.error(`[consentExecutionService] On-chain IDs still valid — appCallTxId: ${consentProof.appCallTxId}`);
    // Don't throw — return partial result with chain IDs
  }

  // ── Step 8: Return structured result ──────────────────────────────────────
  const result = {
    requestId,
    mode:                request.mode,
    decision:            agentDecision.decision,
    finalPrice,
    consentRecorded,
    paymentExecuted,
    algorandAppId:       consentProof.algorandAppId,
    appCallTxId:         consentProof.appCallTxId,
    paymentTxId:         paymentResult?.paymentTxId ?? null,
    usageConditionsHash,
    explorerUrls: {
      appCall: `${EXPLORER_BASE}/tx/${consentProof.appCallTxId}`,
      payment: paymentResult?.paymentTxId
        ? `${EXPLORER_BASE}/tx/${paymentResult.paymentTxId}`
        : null,
    },
    timestamp,
  };

  console.log(`[consentExecutionService] ── Execution complete. consentRecorded=${consentRecorded}, paymentExecuted=${paymentExecuted}`);
  return result;
}

// ── executeConsentAuto ─────────────────────────────────────────────────────────

/**
 * agent_to_agent mode — policy evaluation + consent execution in one call.
 */
async function executeConsentAuto({ requestId, userWallet, companyWallet, companyMnemonic, amount }) {
  console.log(`[consentExecutionService] agent_to_agent flow for request: ${requestId}`);

  const request = await requestRepo.getRequestById(requestId);
  if (!request) {
    const err = new Error(`Request not found: ${requestId}`);
    err.statusCode = 404;
    throw err;
  }

  console.log(`[consentExecutionService] Running policy engine...`);
  const raw = await policyEngine.evaluate(request.dataType, request.offeredPrice, request.purpose);
  console.log(`[consentExecutionService] Policy decision: ${raw.decision} (confidence: ${raw.confidence}%)`);

  const decision = createAgentDecision({
    requestId,
    decision:      raw.decision,
    finalPrice:    raw.finalPrice,
    justification: raw.justification,
    confidence:    raw.confidence,
    riskLevel:     raw.riskLevel,
    ruleTriggers:  raw.ruleTriggers,
    evaluatedBy:   raw.evaluatedBy,
  });

  await decisionRepo.saveDecision(decision);
  await requestRepo.updateStatus(requestId, decision.decision);

  if (decision.decision !== 'approve') {
    console.log(`[consentExecutionService] Rejected by policy engine — no on-chain action`);
    return {
      requestId,
      mode:            'agent_to_agent',
      decision:        decision.decision,
      finalPrice:      decision.finalPrice,
      justification:   decision.justification,
      confidence:      decision.confidence,
      riskLevel:       decision.riskLevel,
      ruleTriggers:    decision.ruleTriggers,
      consentRecorded: false,
      paymentExecuted: false,
      timestamp:       new Date().toISOString(),
    };
  }

  const result = await executeConsent({
    requestId,
    userWallet,
    companyWallet,
    companyMnemonic,
    amount: decision.finalPrice ?? amount,
  });

  return {
    ...result,
    mode:          'agent_to_agent',
    justification: decision.justification,
    confidence:    decision.confidence,
    riskLevel:     decision.riskLevel,
    ruleTriggers:  decision.ruleTriggers,
  };
}

module.exports = { executeConsent, executeConsentAuto };
