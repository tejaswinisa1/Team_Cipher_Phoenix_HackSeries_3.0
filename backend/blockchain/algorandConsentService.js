'use strict';

/**
 * algorandConsentService.js
 *
 * Responsible ONLY for recording consent proof on-chain via an
 * ApplicationCall to the deployed ConsentContract.
 *
 * This service does NOT handle payment. Payment is handled separately
 * by the payment abstraction layer (payments/executePayment.js).
 *
 * On-chain data design:
 * ─────────────────────────────────────────────────────────────────────
 * The contract stores a compact 5-field proof (global state, byte-slices):
 *
 *   request_id            — links this proof to the off-chain Supabase record
 *   consent_status        — "approved" | "rejected"
 *   price                 — agreed ALGO amount (string)
 *   usage_conditions_hash — SHA-256 of canonical consent terms (verifiable)
 *   timestamp             — ISO-8601 when consent was granted
 *
 * The remaining fields (user_wallet, company_wallet, data_type, purpose)
 * are persisted in Supabase (consent_records table) and linked via request_id.
 * They are also embedded in the payment transaction note for auditability.
 *
 * Contract method: recordConsent
 * application_args layout (6 total):
 *   [0] "recordConsent"        — method selector
 *   [1] request_id
 *   [2] consent_status
 *   [3] price (string)
 *   [4] usage_conditions_hash
 *   [5] timestamp
 *
 * Response shape:
 *   { algorandAppId, appCallTxId, confirmedRound, explorerUrl }
 */

const algosdk = require('algosdk');

// ── Algod client (lazy singleton, shared with algorandDirectPayment) ──────────

let _client = null;

function getClient() {
  if (_client) return _client;
  const token  = process.env.ALGORAND_TOKEN  || 'a'.repeat(64);
  const server = process.env.ALGORAND_SERVER || 'https://testnet-api.algonode.cloud';
  const port   = process.env.ALGORAND_PORT   || '';
  _client = new algosdk.Algodv2(token, server, port);
  return _client;
}

// ── Confirmation polling ──────────────────────────────────────────────────────

async function waitForConfirmation(txId, timeoutMs = 60000) {
  const client   = getClient();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const info = await client.pendingTransactionInformation(txId).do();
    if (info['confirmed-round']) {
      return info;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  throw new Error(`App call ${txId} not confirmed within ${timeoutMs / 1000}s`);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record consent proof on-chain via a single ApplicationCall (NoOp).
 * Does NOT submit a payment — call this before or alongside payment separately.
 *
 * @param {object} payload
 * @param {string} payload.signerMnemonic      — 25-word mnemonic of the signing account
 * @param {string} payload.requestId
 * @param {string} payload.userWallet
 * @param {string} payload.companyWallet
 * @param {string} payload.dataType
 * @param {string} payload.purpose
 * @param {string} payload.consentStatus       — "approved" | "rejected"
 * @param {string|number} payload.price        — ALGO amount
 * @param {string} payload.timestamp           — ISO-8601
 * @param {string} payload.usageConditionsHash — 64-char SHA-256 hex
 *
 * @returns {Promise<{ algorandAppId, appCallTxId, confirmedRound, explorerUrl }>}
 */
async function recordConsentOnChain(payload) {
  const {
    signerMnemonic,
    requestId,
    consentStatus,
    price,
    timestamp,
    usageConditionsHash,
  } = payload;

  // ── Validate ALGORAND_APP_ID ───────────────────────────────────────────────
  const appId = parseInt(process.env.ALGORAND_APP_ID, 10);
  if (!appId || isNaN(appId)) {
    throw new Error(
      '[algorandConsentService] ALGORAND_APP_ID is not set or invalid.\n' +
      '  To fix:\n' +
      '    1. cd contracts\n' +
      '    2. pip install -r requirements.txt\n' +
      '    3. Set DEPLOYER_MNEMONIC env var (PowerShell: $env:DEPLOYER_MNEMONIC="...")\n' +
      '    4. python deploy.py\n' +
      '    5. Copy the printed App ID into backend/.env as ALGORAND_APP_ID=<id>\n' +
      '    6. Restart the backend server'
    );
  }

  console.log(`[algorandConsentService] Recording consent for request: ${requestId}`);
  console.log(`[algorandConsentService] App ID: ${appId}`);

  const client = getClient();
  const signer = algosdk.mnemonicToSecretKey(signerMnemonic);
  const sp     = await client.getTransactionParams().do();
  const enc    = (s) => new TextEncoder().encode(String(s));

  // ── Build ApplicationCall ─────────────────────────────────────────────────
  // Stores 5 compact proof fields on-chain.
  // Full consent detail (wallets, dataType, purpose) lives in Supabase.
  const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
    from:       signer.addr,
    appIndex:   appId,
    appArgs: [
      enc('recordConsent'),       // [0] method selector
      enc(requestId),             // [1] links to Supabase record
      enc(consentStatus),         // [2] "approved" | "rejected"
      enc(String(price)),         // [3] ALGO amount
      enc(usageConditionsHash || ''), // [4] SHA-256 proof hash
      enc(timestamp),             // [5] ISO-8601
    ],
    suggestedParams: sp,
  });

  // ── Sign and submit ───────────────────────────────────────────────────────
  let signed, appCallTxId;
  try {
    signed      = appCallTxn.signTxn(signer.sk);
    appCallTxId = appCallTxn.txID();
  } catch (signErr) {
    throw new Error(
      `[algorandConsentService] Failed to sign app call — invalid mnemonic?\n` +
      `  Detail: ${signErr.message}\n` +
      `  Check: the companyMnemonic in your request body is a valid 25-word Algorand mnemonic.`
    );
  }

  console.log(`[algorandConsentService] Submitting app call: ${appCallTxId}`);

  try {
    await client.sendRawTransaction(signed).do();
  } catch (submitErr) {
    // Decode the most common Algorand node rejection reasons
    const msg = submitErr.message || '';
    if (msg.includes('overspend') || msg.includes('balance')) {
      throw new Error(
        `[algorandConsentService] App call rejected — company wallet is underfunded.\n` +
        `  Wallet: ${signer.addr}\n` +
        `  Fix: fund this wallet at https://bank.testnet.algorand.network/\n` +
        `  Detail: ${msg}`
      );
    }
    if (msg.includes('does not exist') || msg.includes('application')) {
      throw new Error(
        `[algorandConsentService] App call rejected — contract not found (App ID ${appId}).\n` +
        `  Fix: re-deploy the contract and update ALGORAND_APP_ID in backend/.env\n` +
        `  Detail: ${msg}`
      );
    }
    throw new Error(`[algorandConsentService] App call submission failed: ${msg}`);
  }

  // ── Wait for confirmation ─────────────────────────────────────────────────
  const confirmed = await waitForConfirmation(appCallTxId);

  console.log(`[algorandConsentService] App call confirmed in round ${confirmed['confirmed-round']}`);

  const explorerUrl = `https://testnet.explorer.perawallet.app/tx/${appCallTxId}`;

  return {
    algorandAppId:  appId,
    appCallTxId,
    confirmedRound: confirmed['confirmed-round'],
    explorerUrl,
  };
}

module.exports = { recordConsentOnChain };
