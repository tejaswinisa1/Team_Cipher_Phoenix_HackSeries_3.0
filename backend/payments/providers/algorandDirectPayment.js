/**
 * algorandDirectPayment.js
 *
 * Payment provider: Algorand native payment via algosdk.
 * This is the ONLY file in the backend that imports algosdk directly.
 *
 * Implements the provider contract expected by executePayment():
 *   execute(payload) → Promise<PaymentResult>
 *
 * execute() is the standalone payment-only path (no app call).
 * It accepts { signerMnemonic, toAddress, amount, note } — the normalised
 * PaymentPayload shape used by consentExecutionService Step 6.
 *
 * The atomic group path (app call + payment together) is available via
 * executeAtomicGroup() for callers that need it (e.g. algorandService).
 *
 * PaymentResult shape:
 *   { paymentTxId, confirmedRound, explorerUrl }
 */

const algosdk = require('algosdk');

// ── Algod client (lazy singleton) ─────────────────────────────────────────────

let _client = null;

function getClient() {
  if (_client) return _client;
  const token  = process.env.ALGORAND_TOKEN  || 'a'.repeat(64);
  const server = process.env.ALGORAND_SERVER || 'https://testnet-api.algonode.cloud';
  const port   = process.env.ALGORAND_PORT   || '';
  _client = new algosdk.Algodv2(token, server, port);
  console.log('✅ Algorand algod client ready');
  return _client;
}

// ── Confirmation polling ──────────────────────────────────────────────────────

async function waitForConfirmation(txId, timeoutMs = 60000) {
  const client   = getClient();
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const info = await client.pendingTransactionInformation(txId).do();
    if (info['confirmed-round']) {
      console.log(`✅ Confirmed in round ${info['confirmed-round']}`);
      return info;
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  throw new Error(`Transaction ${txId} not confirmed within ${timeoutMs / 1000}s`);
}

// ── Provider: executeAtomicGroup ──────────────────────────────────────────────

/**
 * Execute an atomic consent group on Algorand:
 *   Txn 1 — ApplicationCall → ConsentContract.recordConsent
 *   Txn 2 — Payment (company → user)
 *
 * Used by algorandService.recordConsentOnChain() for the combined path.
 * NOT used by consentExecutionService (which separates the two steps).
 *
 * @param {object} payload
 * @param {string} payload.companyMnemonic
 * @param {string} payload.userWallet
 * @param {string} payload.companyWallet
 * @param {number} payload.amount           — ALGO
 * @param {object} payload.consentData      — fields written to smart contract
 * @returns {Promise<{ appCallTxId, paymentTxId, confirmedRound, algorandAppId }>}
 */
async function executeAtomicGroup({ companyMnemonic, userWallet, companyWallet, amount, consentData }) {
  const appId = parseInt(process.env.ALGORAND_APP_ID, 10);
  if (!appId || isNaN(appId)) {
    throw new Error(
      'ALGORAND_APP_ID is not set or invalid.\n' +
      '  Fix:\n' +
      '    1. cd contracts\n' +
      '    2. pip install -r requirements.txt\n' +
      '    3. export DEPLOYER_MNEMONIC="your 25-word mnemonic"\n' +
      '    4. python deploy.py\n' +
      '    5. Copy the printed App ID into backend/.env as ALGORAND_APP_ID=<id>\n' +
      '    6. Restart the backend server'
    );
  }

  const client = getClient();
  const signer = algosdk.mnemonicToSecretKey(companyMnemonic);
  const sp     = await client.getTransactionParams().do();
  const enc    = (s) => new TextEncoder().encode(String(s));

  // Txn 1 — ApplicationCall → ConsentContract.recordConsent
  //
  // Sends only the 5 proof fields that are stored on-chain.
  // The remaining fields (user_wallet, company_wallet, data_type, purpose)
  // are persisted in Supabase and linked via request_id.
  //
  // application_args layout:
  //   [0] "recordConsent"        — method selector
  //   [1] request_id
  //   [2] consent_status         — "approved" | "rejected"
  //   [3] price                  — ALGO string
  //   [4] usage_conditions_hash  — 64-char SHA-256 hex
  //   [5] timestamp              — ISO-8601
  const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
    from: signer.addr,
    appIndex: appId,
    appArgs: [
      enc('recordConsent'),
      enc(consentData.requestId),
      enc(consentData.consentStatus),
      enc(String(consentData.price)),
      enc(consentData.usageConditionsHash || ''),
      enc(consentData.timestamp),
    ],
    suggestedParams: sp,
  });

  // Txn 2 — Payment
  const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: signer.addr,
    to: userWallet,
    amount: algosdk.algosToMicroalgos(amount),
    note: enc(JSON.stringify({
      requestId:     consentData.requestId,
      consentStatus: consentData.consentStatus,
      appId,
    })),
    suggestedParams: sp,
  });

  // Atomic group
  algosdk.assignGroupID([appCallTxn, paymentTxn]);

  const signedAppCall = appCallTxn.signTxn(signer.sk);
  const signedPayment = paymentTxn.signTxn(signer.sk);

  const { txId: groupTxId } = await client
    .sendRawTransaction([signedAppCall, signedPayment])
    .do();

  console.log(`📡 Atomic group submitted: ${groupTxId}`);

  const appCallTxId = appCallTxn.txID();
  const paymentTxId = paymentTxn.txID();

  const confirmed = await waitForConfirmation(appCallTxId);

  return {
    appCallTxId,
    paymentTxId,
    confirmedRound: confirmed['confirmed-round'],
    algorandAppId:  appId,
  };
}

/**
 * Fetch on-chain transaction details.
 * @param {string} txId
 */
async function getTransactionDetails(txId) {
  const client = getClient();
  const txn    = await client.pendingTransactionInformation(txId).do();

  let metadata = {};
  if (txn.txn?.note) {
    try {
      metadata = JSON.parse(new TextDecoder().decode(new Uint8Array(txn.txn.note)));
    } catch {
      metadata = { raw: txn.txn.note };
    }
  }

  return {
    txId,
    confirmedRound: txn['confirmed-round'],
    sender:   txn.txn.snd,
    receiver: txn.txn.rcv,
    amount:   algosdk.microalgosToAlgos(txn.txn.amt || 0),
    fee:      algosdk.microalgosToAlgos(txn.txn.fee || 0),
    timestamp: new Date().toISOString(),
    metadata,
  };
}

/**
 * Fetch account balance.
 * @param {string} address
 */
async function getAccountInfo(address) {
  const client = getClient();
  const info   = await client.accountInformation(address).do();
  return {
    address,
    balance:    algosdk.microalgosToAlgos(info.amount),
    minBalance: algosdk.microalgosToAlgos(info['min-balance']),
    rewards:    info.rewards,
  };
}

/**
 * executePaymentOnly
 *
 * Send a standalone payment transaction (no app call).
 * Used when consent proof has already been recorded separately.
 * Accepts { signerMnemonic, toAddress, amount, note }
 *
 * @param {object} payload
 * @param {string} payload.signerMnemonic
 * @param {string} payload.toAddress       — recipient (user wallet)
 * @param {number} payload.amount          — ALGO
 * @param {string} [payload.note]          — optional note string
 * @returns {Promise<{ paymentTxId, confirmedRound, explorerUrl }>}
 */
async function executePaymentOnly({ signerMnemonic, toAddress, amount, note }) {
  const client = getClient();

  let signer;
  try {
    signer = algosdk.mnemonicToSecretKey(signerMnemonic);
  } catch (e) {
    throw new Error(
      `[algorandDirectPayment] Invalid mnemonic — cannot sign payment.\n` +
      `  Detail: ${e.message}\n` +
      `  Check: companyMnemonic must be a valid 25-word Algorand mnemonic.`
    );
  }

  const sp  = await client.getTransactionParams().do();
  const enc = (s) => new TextEncoder().encode(String(s));

  const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from:            signer.addr,
    to:              toAddress,
    amount:          algosdk.algosToMicroalgos(amount),
    note:            note ? enc(note) : undefined,
    suggestedParams: sp,
  });

  const signed      = paymentTxn.signTxn(signer.sk);
  const paymentTxId = paymentTxn.txID();

  try {
    await client.sendRawTransaction(signed).do();
  } catch (submitErr) {
    const msg = submitErr.message || '';
    if (msg.includes('overspend') || msg.includes('balance')) {
      throw new Error(
        `[algorandDirectPayment] Payment rejected — company wallet is underfunded.\n` +
        `  Wallet: ${signer.addr}\n` +
        `  Fix: fund this wallet at https://bank.testnet.algorand.network/\n` +
        `  Detail: ${msg}`
      );
    }
    throw new Error(`[algorandDirectPayment] Payment submission failed: ${msg}`);
  }

  console.log(`[algorandDirectPayment] Payment submitted: ${paymentTxId}`);

  const confirmed = await waitForConfirmation(paymentTxId);

  return {
    paymentTxId,
    confirmedRound: confirmed['confirmed-round'],
    explorerUrl: `https://testnet.explorer.perawallet.app/tx/${paymentTxId}`,
  };
}

// ── Single export ─────────────────────────────────────────────────────────────
// execute = executePaymentOnly: the normalised provider contract used by
//   executePayment(DEFAULT_PROVIDER, { signerMnemonic, toAddress, amount, note })
// executeAtomicGroup: the combined app-call + payment path used by algorandService
module.exports = { execute: executePaymentOnly, executeAtomicGroup, executePaymentOnly, getTransactionDetails, getAccountInfo };
