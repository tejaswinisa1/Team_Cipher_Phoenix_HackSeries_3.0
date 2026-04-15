/**
 * executePayment.js
 *
 * Payment abstraction layer.
 * The rest of the backend calls this function — never a provider directly.
 *
 * Usage:
 *   const { executePayment } = require('./payments/executePayment');
 *
 *   const result = await executePayment('algorandDirectPayment', {
 *     companyMnemonic, userWallet, companyWallet, amount, consentData
 *   });
 *
 * Supported providers:
 *   'algorandDirectPayment' — Algorand native payment + app call (algosdk)
 *   'x402'                  — x402 HTTP payment protocol (stub)
 *
 * All providers must implement:
 *   execute(payload) → Promise<{ appCallTxId, paymentTxId, confirmedRound, algorandAppId }>
 */

const algorandDirectPayment = require('./providers/algorandDirectPayment');
const x402Provider          = require('./providers/x402Provider');

const PROVIDERS = {
  algorandDirectPayment,
  x402: x402Provider,
};

/** Default provider used when no explicit provider name is given. */
const DEFAULT_PROVIDER = 'algorandDirectPayment';

/**
 * Dispatch a payment to the specified provider.
 *
 * @param {string} provider  — one of the keys in PROVIDERS
 * @param {object} payload   — provider-specific payload
 * @returns {Promise<object>} PaymentResult
 * @throws {Error} if provider is unknown or the payment fails
 */
async function executePayment(provider, payload) {
  const impl = PROVIDERS[provider];

  if (!impl) {
    throw new Error(
      `Unknown payment provider: "${provider}". ` +
      `Available: ${Object.keys(PROVIDERS).join(', ')}`
    );
  }

  console.log(`💳 executePayment → provider: ${provider}`);
  return impl.execute(payload);
}

module.exports = { executePayment, PROVIDERS, DEFAULT_PROVIDER };
