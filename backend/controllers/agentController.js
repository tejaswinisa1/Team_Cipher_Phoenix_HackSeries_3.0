'use strict';

const policyEngine      = require('../agent/policyEngine');
const { createAgentDecision } = require('../models');
const requestRepository = require('../db/requestRepository');
const decisionRepository = require('../db/decisionRepository');
const { DEFAULT_PREFERENCES } = require('./dataPreferencesController');
const supabase = require('../db/supabaseClient');

/**
 * Fetch user data preferences from Supabase, falling back to defaults.
 * @param {string} userWallet
 * @returns {Promise<object>}
 */
async function fetchUserPreferences(userWallet) {
  if (!userWallet) return DEFAULT_PREFERENCES;
  try {
    const { data } = await supabase
      .from('user_data_preferences')
      .select('preferences')
      .eq('user_wallet', userWallet)
      .maybeSingle();
    return data?.preferences ?? DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/**
 * POST /api/agent-decision
 * Body: { requestId }
 *
 * Runs the policy engine against the stored request and persists the decision.
 * Route handler stays thin — all evaluation logic is in policyEngine.
 */
const evaluateDecision = async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) {
      return res.status(400).json({ success: false, message: 'Missing required field: requestId' });
    }

    const request = await requestRepository.getRequestById(requestId);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    console.log(`[agentController] Evaluating request: ${requestId}`);

    // Fetch user preferences to apply to policy evaluation
    const userPreferences = await fetchUserPreferences(request.userWallet);

    // Policy engine: user preferences → rules → LLM → fallback
    const raw = await policyEngine.evaluate(request.dataType, request.offeredPrice, request.purpose, userPreferences);

    const decision = createAgentDecision({
      requestId,
      decision:      raw.decision,
      finalPrice:    raw.finalPrice,
      justification: raw.justification,
      confidence:    raw.confidence,
      riskLevel:     raw.riskLevel,
      ruleTriggers:  raw.ruleTriggers,
      evaluatedBy:   raw.evaluatedBy
    });

    await decisionRepository.saveDecision(decision);
    await requestRepository.updateStatus(requestId, decision.decision);

    console.log(`[agentController] Decision: ${decision.decision} (by: ${decision.evaluatedBy}, confidence: ${decision.confidence}%)`);

    return res.status(200).json({
      success:              true,
      requestId,
      decision:             decision.decision,
      originalPrice:        raw.originalPrice,
      suggestedPrice:       raw.suggestedPrice,
      finalPrice:           decision.finalPrice,
      negotiationReasoning: raw.negotiationReasoning ?? [],
      justification:        decision.justification,
      confidence:           decision.confidence,
      riskLevel:            decision.riskLevel,
      ruleTriggers:         decision.ruleTriggers,
      evaluatedBy:          decision.evaluatedBy,
      evaluatedAt:          decision.evaluatedAt,
      message: 'Policy evaluation completed'
    });
  } catch (error) {
    console.error(`[agentController] Error: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Policy evaluation failed', error: error.message });
  }
};

module.exports = { evaluateDecision };
