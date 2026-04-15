/**
 * policyConfig.js
 *
 * Single source of truth for all policy engine thresholds and classifications.
 * Change values here to adjust decision behaviour without touching logic files.
 */

module.exports = {
  // Price thresholds (ALGO)
  PRICE_FLOOR:     10,   // Hard reject below this — protects data value
  PRICE_UNCERTAIN: 20,   // Below this (and not sensitive) → escalate to LLM
  PRICE_PREMIUM:   100,  // Above this (and not sensitive) → auto-approve

  // Negotiation: minimum uplift % applied when suggesting a higher price
  // e.g. 0.25 means suggest at least 25% above the offered price when it's low
  NEGOTIATION_UPLIFT: 0.25,

  // Data types that are always rejected regardless of price
  SENSITIVE_DATA_TYPES: [
    'health',
    'financial',
    'biometric',
    'government_id',
    'medical',
    'genetic',
  ],

  // LLM model settings
  // llama-3.3-70b-versatile is the current recommended replacement for
  // the decommissioned llama-3.1-70b-versatile (see console.groq.com/docs/deprecations)
  LLM_MODEL:       'llama-3.3-70b-versatile',
  LLM_TEMPERATURE: 0.3,
  LLM_MAX_TOKENS:  600,
};
