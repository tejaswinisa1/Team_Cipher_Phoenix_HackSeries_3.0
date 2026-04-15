/**
 * hashUtils.js
 *
 * Deterministic SHA-256 hashing for consent usage conditions.
 *
 * Determinism rules:
 *   1. All input fields are sorted alphabetically by key (canonical JSON).
 *   2. All values are coerced to strings so numeric/string variants hash identically.
 *   3. No timestamps or random values are included — same inputs always produce
 *      the same hash, making the record independently verifiable by any party.
 */

const crypto = require('crypto');

/**
 * Build a canonical JSON string from a plain object.
 * Keys are sorted alphabetically; all values are stringified.
 *
 * @param {object} obj
 * @returns {string} Canonical JSON
 */
function toCanonicalJSON(obj) {
  const sorted = Object.keys(obj)
    .sort()
    .reduce((acc, key) => {
      acc[key] = String(obj[key]);
      return acc;
    }, {});
  return JSON.stringify(sorted);
}

/**
 * Compute a deterministic SHA-256 hex digest over the consent usage conditions.
 *
 * Input fields (all required):
 *   @param {string} requestId      — DataRequest.id
 *   @param {string} userWallet     — Algorand address of the data owner
 *   @param {string} companyWallet  — Algorand address of the requesting company
 *   @param {string} dataType       — e.g. "location", "browsing"
 *   @param {string} purpose        — stated reason for data access
 *   @param {number|string} price   — agreed price in ALGO
 *   @param {string} decision       — "approve" | "reject"
 *   @param {string} timestamp      — ISO-8601 consent timestamp (fixed at call time)
 *
 * @returns {string} 64-character lowercase hex SHA-256 digest
 *
 * Example:
 *   computeUsageConditionsHash({
 *     requestId: 'req_123_abc',
 *     userWallet: 'ALGO...',
 *     companyWallet: 'ALGO...',
 *     dataType: 'location',
 *     purpose: 'Market research',
 *     price: 25,
 *     decision: 'approve',
 *     timestamp: '2026-04-11T10:00:00.000Z'
 *   })
 *   // → 'a3f9...' (64 hex chars)
 */
function computeUsageConditionsHash({
  requestId,
  userWallet,
  companyWallet,
  dataType,
  purpose,
  price,
  decision,
  timestamp
}) {
  const payload = toCanonicalJSON({
    requestId,
    userWallet,
    companyWallet,
    dataType,
    purpose,
    price,
    decision,
    timestamp
  });

  return crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

module.exports = { computeUsageConditionsHash, toCanonicalJSON };
