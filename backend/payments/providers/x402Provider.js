/**
 * x402Provider.js
 *
 * Payment provider stub: x402 HTTP payment protocol.
 * https://x402.org
 *
 * x402 enables HTTP-native payments where a server responds with
 * HTTP 402 Payment Required and the client fulfils the payment
 * before retrying the request.
 *
 * This stub preserves the provider contract so the abstraction layer
 * can route to x402 once a real integration is wired up.
 * No real x402 dependencies are imported here.
 *
 * Implements:
 *   execute(payload) → Promise<never>  (always rejects until implemented)
 *
 * Future integration: replace the body of execute() following the
 * x402-INTEGRATION comments below. No other file needs to change.
 */

/**
 * Structured error thrown by the x402 stub.
 * Extends Error so it is instanceof-compatible with standard error handling.
 */
class NotImplementedError extends Error {
  /**
   * @param {string} message
   * @param {object} meta
   */
  constructor(message, meta = {}) {
    super(message);
    this.name     = 'NotImplementedError';
    this.provider = meta.provider ?? 'x402';
    this.stub     = true;
  }
}

/**
 * Execute a payment via the x402 protocol.
 *
 * @param {object} payload
 * @param {string} [payload.toAddress]     — recipient wallet / endpoint
 * @param {number} [payload.amount]        — payment amount
 * @param {string} [payload.signerMnemonic]— payer credential
 * @returns {Promise<never>}  always rejects until implemented
 */
async function execute(payload) {  // eslint-disable-line no-unused-vars
  // x402-INTEGRATION point 1: Build Payment header
  //   Construct the `X-Payment` header per the x402 spec.
  //   Use payload.amount, payload.toAddress, and a network-specific
  //   PaymentRequirements object to build the signed payment header.
  //
  //   Example (future):
  //     const { buildPaymentHeader } = require('x402-js');
  //     const header = await buildPaymentHeader(paymentRequirements, signerKey);

  // x402-INTEGRATION point 2: POST to x402-enabled endpoint
  //   Send the initial request to the resource server.
  //   Expect a `402 Payment Required` response containing the
  //   `X-Payment-Response` header with payment requirements.
  //
  //   Example (future):
  //     const response = await fetch(payload.endpoint, { method: 'POST', ... });
  //     if (response.status !== 402) throw new Error('Expected 402');
  //     const requirements = response.headers.get('X-Payment-Response');

  // x402-INTEGRATION point 3: Fulfil payment
  //   Parse the 402 response, sign the payment requirement,
  //   attach the `X-Payment` header, and retry the request.
  //
  //   Example (future):
  //     const fulfilled = await fetch(payload.endpoint, {
  //       method: 'POST',
  //       headers: { 'X-Payment': header },
  //       ...
  //     });

  // x402-INTEGRATION point 4: Normalise result
  //   Map the x402 confirmation to the standard PaymentResult shape:
  //   { paymentTxId, confirmedRound, explorerUrl }
  //
  //   Example (future):
  //     const confirmation = await fulfilled.json();
  //     return {
  //       paymentTxId:    confirmation.txHash,
  //       confirmedRound: confirmation.blockNumber,
  //       explorerUrl:    `https://testnet.explorer.perawallet.app/tx/${confirmation.txHash}`,
  //     };

  throw new NotImplementedError('x402Provider: not yet implemented', { provider: 'x402' });
}

module.exports = { execute, NotImplementedError };
