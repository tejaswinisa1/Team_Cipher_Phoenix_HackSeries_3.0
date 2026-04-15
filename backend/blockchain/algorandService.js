'use strict';

/**
 * algorandService.js
 *
 * Blockchain service facade.
 * Coordinates on-chain operations by delegating to focused sub-services:
 *
 *   algorandConsentService  — ApplicationCall to ConsentContract (proof only)
 *   algorandDirectPayment   — Payment transaction + atomic group with app call
 *
 * The consentExecutionService calls recordConsentOnChain() here, which
 * dispatches through the payment abstraction layer so both the app call
 * and payment are submitted as an atomic group.
 *
 * If you need ONLY the app call (no payment), use algorandConsentService directly.
 */

const algorandDirectPayment     = require('../payments/providers/algorandDirectPayment');
const algorandConsentService    = require('./algorandConsentService');

/**
 * Record consent on-chain via an atomic group (app call + payment).
 * Calls executeAtomicGroup directly — both transactions submitted atomically.
 * Either both confirm or neither does.
 *
 * @param {object} params
 * @param {string} params.companyMnemonic
 * @param {string} params.userWallet
 * @param {string} params.companyWallet
 * @param {number} params.amount
 * @param {object} params.consentData
 * @returns {Promise<{ appCallTxId, paymentTxId, confirmedRound, algorandAppId }>}
 */
async function recordConsentOnChain(params) {
  return algorandDirectPayment.executeAtomicGroup(params);
}

/**
 * Record ONLY the consent proof on-chain (no payment).
 * Use this when you need to separate the app call from payment execution.
 *
 * @param {object} payload — see algorandConsentService.recordConsentOnChain
 * @returns {Promise<{ algorandAppId, appCallTxId, confirmedRound, explorerUrl }>}
 */
async function recordConsentProofOnly(payload) {
  return algorandConsentService.recordConsentOnChain(payload);
}

/**
 * Fetch on-chain transaction details.
 * @param {string} txId
 */
async function getTransactionDetails(txId) {
  return algorandDirectPayment.getTransactionDetails(txId);
}

/**
 * Fetch account balance and metadata.
 * @param {string} address
 */
async function getAccountInfo(address) {
  return algorandDirectPayment.getAccountInfo(address);
}

module.exports = {
  recordConsentOnChain,
  recordConsentProofOnly,
  getTransactionDetails,
  getAccountInfo,
};
