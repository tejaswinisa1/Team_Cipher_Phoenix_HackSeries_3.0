/**
 * Policy Engine — decision aggregator.
 *
 * Flow:
 *   1. Rule layer  → deterministic, synchronous
 *   2. LLM layer   → only for uncertain cases
 *   3. Fallback    → if LLM unavailable or throws
 *
 * Always returns a fully-populated result including negotiation fields:
 *   { decision, originalPrice, finalPrice, suggestedPrice,
 *     negotiationReasoning, justification, confidence,
 *     riskLevel, ruleTriggers, evaluatedBy }
 *
 * Negotiation fields:
 *   originalPrice        — the price as submitted by the company
 *   suggestedPrice       — AI's recommended fair price
 *   negotiationReasoning — bullet-point array explaining the suggestion
 */

const ruleLayer = require('./ruleLayer');
const llmLayer  = require('./llmLayer');
const { NEGOTIATION_UPLIFT, PRICE_UNCERTAIN } = require('./policyConfig');

// Initialise LLM client once at startup
llmLayer.init();

/**
 * Evaluate a data sharing request through the full policy pipeline.
 *
 * @param {string} dataType
 * @param {number} price       — the offered price (originalPrice)
 * @param {string} purpose
 * @param {object} [userPreferences]  — optional per-user data type preferences
 *   { [dataType]: 'allowed' | 'restricted' | 'blocked' }
 *   blocked    → immediate reject (USER_BLOCKED rule)
 *   restricted → riskLevel elevated to 'high', escalated to LLM
 * @returns {Promise<object>}  Aggregated decision with negotiation fields
 */
async function evaluate(dataType, price, purpose, userPreferences = {}) {
  console.log(`🔍 Policy engine: dataType=${dataType}, price=${price}`);

  // ── User preference check (before rule layer) ────────────────────────────
  const preference = userPreferences[dataType.toLowerCase()] ?? 'allowed';

  if (preference === 'blocked') {
    console.log(`🚫 User blocked data type: ${dataType}`);
    const suggestedPrice = null;
    return {
      decision:             'reject',
      originalPrice:        price,
      finalPrice:           price,
      suggestedPrice,
      negotiationReasoning: [
        `You have blocked sharing of "${dataType}" data`,
        'Update your Data Assets preferences to allow or restrict this type',
        'No price adjustment can override a user block',
      ],
      justification:        `User has blocked "${dataType}" data type. Request automatically rejected per user preferences.`,
      confidence:           100,
      riskLevel:            'high',
      ruleTriggers:         ['USER_BLOCKED'],
      evaluatedBy:          'rules',
    };
  }

  // ── Layer 1: rules ───────────────────────────────────────────────────────
  const ruleResult = ruleLayer.evaluate(dataType, price);

  // If restricted by user, elevate riskLevel before escalating to LLM
  if (preference === 'restricted' && !ruleResult.decided) {
    ruleResult.riskLevel = 'high';
    ruleResult.ruleTriggers = [...(ruleResult.ruleTriggers || []), 'USER_RESTRICTED'];
    console.log(`⚠️  User restricted data type: ${dataType} — riskLevel elevated to high`);
  }

  if (ruleResult.decided) {
    console.log(`📋 Rule decision: ${ruleResult.decision} [${ruleResult.ruleTriggers.join(', ')}]`);
    return {
      decision:             ruleResult.decision,
      originalPrice:        price,
      finalPrice:           ruleResult.finalPrice,
      suggestedPrice:       ruleResult.suggestedPrice ?? ruleResult.finalPrice,
      negotiationReasoning: ruleResult.negotiationReasoning ?? [],
      justification:        ruleResult.justification,
      confidence:           ruleResult.confidence,
      riskLevel:            ruleResult.riskLevel,
      ruleTriggers:         ruleResult.ruleTriggers,
      evaluatedBy:          'rules',
    };
  }

  // ── Layer 2: LLM ─────────────────────────────────────────────────────────
  if (llmLayer.isAvailable()) {
    try {
      console.log('🧠 Escalating to LLM layer...');
      const llmResult = await llmLayer.evaluate(dataType, price, purpose);
      console.log(`✨ LLM decision: ${llmResult.decision} (confidence: ${llmResult.confidence}%)`);
      return {
        decision:             llmResult.decision,
        originalPrice:        price,
        finalPrice:           llmResult.finalPrice,
        suggestedPrice:       llmResult.suggestedPrice,
        negotiationReasoning: llmResult.negotiationReasoning,
        justification:        llmResult.justification,
        confidence:           llmResult.confidence,
        riskLevel:            llmResult.riskLevel || ruleResult.riskLevel,
        ruleTriggers:         ruleResult.ruleTriggers,
        evaluatedBy:          'ai',
      };
    } catch (err) {
      console.error(`❌ LLM layer failed: ${err.message} — falling back to rules`);
    }
  }

  // ── Layer 3: fallback ────────────────────────────────────────────────────
  return _fallback(price, ruleResult);
}

/**
 * Deterministic fallback when LLM is unavailable or errors.
 */
function _fallback(price, ruleResult) {
  const approve = price >= PRICE_UNCERTAIN;
  const suggestedPrice = approve
    ? price
    : Math.ceil(PRICE_UNCERTAIN * (1 + NEGOTIATION_UPLIFT));

  console.log(`⚠️  Fallback decision: ${approve ? 'approve' : 'reject'}`);
  return {
    decision:      approve ? 'approve' : 'reject',
    originalPrice: price,
    finalPrice:    price,
    suggestedPrice,
    negotiationReasoning: approve
      ? [
          `Price (${price} ALGO) meets the fallback approval threshold`,
          'LLM unavailable — deterministic fallback applied',
          'Accepted at offered price',
        ]
      : [
          `Price (${price} ALGO) is below the fallback threshold of ${PRICE_UNCERTAIN} ALGO`,
          'LLM unavailable — deterministic fallback applied',
          `Suggested price: ${suggestedPrice} ALGO to meet minimum requirements`,
        ],
    justification: approve
      ? `LLM unavailable. Price (${price} ALGO) meets the fallback approval threshold of ${PRICE_UNCERTAIN} ALGO.`
      : `LLM unavailable. Price (${price} ALGO) is below the fallback approval threshold of ${PRICE_UNCERTAIN} ALGO.`,
    confidence:    60,
    riskLevel:     ruleResult.riskLevel,
    ruleTriggers:  [...ruleResult.ruleTriggers, 'LLM_FALLBACK'],
    evaluatedBy:   'fallback',
  };
}

module.exports = { evaluate };
