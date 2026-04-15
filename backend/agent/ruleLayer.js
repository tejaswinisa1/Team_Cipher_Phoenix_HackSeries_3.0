/**
 * Rule Layer — deterministic, synchronous, no external dependencies.
 *
 * Each rule returns a result object:
 *   { decided: true,  decision, finalPrice, suggestedPrice, negotiationReasoning,
 *     justification, confidence, riskLevel, ruleTriggers }
 *   { decided: false, riskLevel, ruleTriggers }   ← uncertain, escalate to LLM
 *
 * suggestedPrice — the AI's recommended fair price (may differ from finalPrice
 *   on rejections to signal what would be acceptable)
 * negotiationReasoning — bullet-point array explaining the price suggestion
 *
 * All thresholds are configured in policyConfig.js.
 */

const {
  SENSITIVE_DATA_TYPES,
  PRICE_FLOOR,
  PRICE_UNCERTAIN,
  PRICE_PREMIUM,
  NEGOTIATION_UPLIFT,
} = require('./policyConfig');

/**
 * Evaluate a request against all deterministic rules.
 *
 * @param {string} dataType
 * @param {number} price
 * @returns {{ decided: boolean, decision?: string, finalPrice?: number,
 *             suggestedPrice?: number, negotiationReasoning?: string[],
 *             justification?: string, confidence?: number,
 *             riskLevel: string, ruleTriggers: string[] }}
 */
function evaluate(dataType, price) {
  const type = dataType.toLowerCase().trim();
  const ruleTriggers = [];

  // ── Rule 1: price floor ──────────────────────────────────────────────────
  if (price < PRICE_FLOOR) {
    ruleTriggers.push('PRICE_BELOW_FLOOR');
    const suggestedPrice = Math.ceil(PRICE_FLOOR * (1 + NEGOTIATION_UPLIFT));
    return {
      decided: true,
      decision: 'reject',
      finalPrice: price,
      suggestedPrice,
      negotiationReasoning: [
        `Offered price (${price} ALGO) is below the minimum floor of ${PRICE_FLOOR} ALGO`,
        `Fair market value for this data type starts at ${PRICE_FLOOR} ALGO`,
        `AI suggests ${suggestedPrice} ALGO to ensure fair compensation`,
        'Resubmit with the suggested price to proceed',
      ],
      justification: `Offered price (${price} ALGO) is below the minimum threshold of ${PRICE_FLOOR} ALGO. Request rejected to protect data value.`,
      confidence: 100,
      riskLevel: 'high',
      ruleTriggers,
    };
  }

  // ── Rule 2: sensitive data type ──────────────────────────────────────────
  if (SENSITIVE_DATA_TYPES.includes(type)) {
    ruleTriggers.push('SENSITIVE_DATA_TYPE');
    return {
      decided: true,
      decision: 'reject',
      finalPrice: price,
      suggestedPrice: null,   // no price suggestion — type is always rejected
      negotiationReasoning: [
        `"${dataType}" is classified as sensitive under the DPDP Act 2023`,
        'Sensitive data types are permanently rejected regardless of price',
        'No price adjustment can override this protection',
      ],
      justification: `Data type "${dataType}" is classified as sensitive under the DPDP Act 2023. Automatic rejection for user protection.`,
      confidence: 100,
      riskLevel: 'high',
      ruleTriggers,
    };
  }

  // ── Rule 3: high-value safe request ─────────────────────────────────────
  if (price > PRICE_PREMIUM) {
    ruleTriggers.push('HIGH_VALUE_SAFE');
    return {
      decided: true,
      decision: 'approve',
      finalPrice: price,
      suggestedPrice: price,  // already fair — no adjustment needed
      negotiationReasoning: [
        `Offered price (${price} ALGO) exceeds the premium threshold of ${PRICE_PREMIUM} ALGO`,
        'High-value offer signals strong intent and fair compensation',
        'No price adjustment needed — accepted at offered price',
      ],
      justification: `High-value offer (${price} ALGO) exceeds the premium threshold of ${PRICE_PREMIUM} ALGO for non-sensitive data. Approved.`,
      confidence: 90,
      riskLevel: 'low',
      ruleTriggers,
    };
  }

  // ── Uncertain — escalate to LLM ─────────────────────────────────────────
  const riskLevel = price < PRICE_UNCERTAIN ? 'medium' : 'low';
  return { decided: false, riskLevel, ruleTriggers };
}

module.exports = { evaluate, SENSITIVE_DATA_TYPES, PRICE_FLOOR, PRICE_UNCERTAIN, PRICE_PREMIUM };
