/**
 * LLM Layer — Groq-backed evaluation for uncertain cases.
 * Only called when the rule layer returns { decided: false }.
 *
 * Returns the standard decision fields PLUS negotiation fields:
 *   suggestedPrice       — AI's recommended fair price
 *   negotiationReasoning — array of bullet-point strings explaining the suggestion
 */

const Groq = require('groq-sdk');

let groqClient = null;

function init() {
  const apiKey = process.env.GROQ_API_KEY;
  if (apiKey) {
    groqClient = new Groq({ apiKey });
    console.log('✅ Groq AI client initialized');
  } else {
    console.warn('⚠️  GROQ_API_KEY not set — LLM layer disabled, fallback will be used');
  }
}

/**
 * Ask the LLM to evaluate an uncertain request and suggest a fair price.
 *
 * @param {string} dataType
 * @param {number} price
 * @param {string} purpose
 * @returns {Promise<{ decision, finalPrice, suggestedPrice, negotiationReasoning,
 *                     justification, confidence, riskLevel }>}
 */
async function evaluate(dataType, price, purpose) {
  if (!groqClient) {
    throw new Error('LLM client not initialised');
  }

  const systemPrompt = `You are a Data Privacy AI Agent for DataDAO India, operating under the Digital Personal Data Protection Act, 2023 (India).

Evaluate data sharing requests and return a JSON object with EXACTLY these fields:
- decision: "approve" or "reject"
- finalPrice: number (the price that will actually be used if approved)
- suggestedPrice: number (your recommended fair price — may differ from offered price)
- negotiationReasoning: array of 3-4 short strings, each a bullet point explaining your price suggestion
- justification: string (2-3 sentences explaining your overall decision)
- confidence: integer 0-100
- riskLevel: "low", "medium", or "high"

Negotiation logic:
- If offered price is low but acceptable: suggest a moderately higher price (10-30% uplift), approve at suggestedPrice
- If offered price is fair: suggestedPrice = finalPrice = offeredPrice, approve
- If offered price is too low to approve: reject, but still suggest what price would be acceptable
- negotiationReasoning bullets should explain WHY you suggest that price

Be conservative — protect user privacy first.`;

  const userPrompt = `Evaluate this data sharing request:
Data Type: ${dataType}
Offered Price: ${price} ALGO
Purpose: ${purpose}`;

  const response = await groqClient.chat.completions.create({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    model: require('./policyConfig').LLM_MODEL,
    temperature: require('./policyConfig').LLM_TEMPERATURE,
    max_tokens: require('./policyConfig').LLM_MAX_TOKENS,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Empty response from LLM');

  const parsed = JSON.parse(content);

  if (!parsed.decision || parsed.finalPrice == null || !parsed.justification) {
    throw new Error('LLM response missing required fields');
  }

  return {
    decision:             parsed.decision.toLowerCase(),
    finalPrice:           parseFloat(parsed.finalPrice) || price,
    suggestedPrice:       parseFloat(parsed.suggestedPrice) || parseFloat(parsed.finalPrice) || price,
    negotiationReasoning: Array.isArray(parsed.negotiationReasoning)
      ? parsed.negotiationReasoning
      : [parsed.justification],
    justification:        parsed.justification,
    confidence:           typeof parsed.confidence === 'number' ? Math.round(parsed.confidence) : null,
    riskLevel:            parsed.riskLevel || null,
  };
}

function isAvailable() {
  return groqClient !== null;
}

module.exports = { init, evaluate, isAvailable };
