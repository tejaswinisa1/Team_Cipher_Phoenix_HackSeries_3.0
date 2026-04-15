'use strict';

/**
 * contractController.js
 * Thin HTTP wrapper — all business logic lives in consentExecutionService.
 */

const { executeConsent }    = require('../services/consentExecutionService');
const algorandService       = require('../blockchain/algorandService');
const consentRepository     = require('../db/consentRepository');

// ── POST /api/execute-contract ────────────────────────────────────────────────

const executeContract = async (req, res) => {
  try {
    const { userWallet, companyWallet, companyMnemonic, amount, requestId } = req.body;

    if (!userWallet || !companyWallet || !companyMnemonic || !amount || !requestId) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: userWallet, companyWallet, companyMnemonic, amount, requestId'
      });
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Amount must be a positive number' });
    }

    const result = await executeConsent({ requestId, userWallet, companyWallet, companyMnemonic, amount });

    // Return the full structured result plus txId alias for frontend compat
    return res.status(200).json({
      success: true,
      requestId:           result.requestId,
      mode:                result.mode,
      decision:            result.decision,
      finalPrice:          result.finalPrice,
      consentRecorded:     result.consentRecorded,
      paymentExecuted:     result.paymentExecuted,
      algorandAppId:       result.algorandAppId,
      appCallTxId:         result.appCallTxId,
      paymentTxId:         result.paymentTxId,
      txId:                result.paymentTxId,   // frontend compat alias
      usageConditionsHash: result.usageConditionsHash,
      explorerUrls:        result.explorerUrls,
      timestamp:           result.timestamp,
      message: 'Consent recorded on Algorand smart contract'
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.error(`[contractController] executeContract error: ${error.message}`);

    // Surface partial result if available (chain succeeded but DB failed)
    return res.status(status).json({
      success: false,
      message: error.message,
      partial: error.partial || null
    });
  }
};

// ── GET /api/execute-contract/:txId ───────────────────────────────────────────
//
// The :txId param may be either a paymentTxId (from the frontend redirect after
// execution) or a requestId (from a direct lookup). We try both:
//   1. Look up ConsentRecord by requestId (covers the requestId case)
//   2. If not found, look up ConsentRecord by paymentTxId
//   3. Fetch on-chain details using the resolved paymentTxId

const getTransactionDetails = async (req, res) => {
  try {
    const { txId } = req.params;
    if (!txId) return res.status(400).json({ success: false, message: 'Missing transaction ID' });

    // Try requestId first, then paymentTxId
    let record = await consentRepository.getConsentRecordByRequestId(txId).catch(() => null);
    if (!record) {
      record = await consentRepository.getConsentRecordByPaymentTxId(txId).catch(() => null);
    }

    // Resolve the actual on-chain tx ID to fetch details
    const onChainTxId = record?.paymentTxId ?? record?.appCallTxId ?? txId;

    const details = await algorandService.getTransactionDetails(onChainTxId).catch(() => null);

    return res.status(200).json({
      success:       true,
      transaction:   details   || null,
      consentRecord: record    || null
    });
  } catch (error) {
    console.error(`[contractController] getTransactionDetails error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/consent-records ──────────────────────────────────────────────────

const getAllConsentRecords = async (_req, res) => {
  try {
    const consentRecords = await consentRepository.queryConsentRecords({ limit: 100 });
    return res.status(200).json({ success: true, consentRecords });
  } catch (error) {
    console.error(`[contractController] getAllConsentRecords error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

// ── GET /api/consent-records/:requestId ───────────────────────────────────────

const getConsentRecordByRequestId = async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!requestId) return res.status(400).json({ success: false, message: 'Missing requestId' });
    const record = await consentRepository.getConsentRecordByRequestId(requestId);
    return res.status(200).json({ success: true, consentRecord: record || null });
  } catch (error) {
    console.error(`[contractController] getConsentRecordByRequestId error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = { executeContract, getTransactionDetails, getAllConsentRecords, getConsentRecordByRequestId };
