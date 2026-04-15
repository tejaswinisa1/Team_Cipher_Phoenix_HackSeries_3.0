/**
 * api.ts
 *
 * Typed API client for the DataDAO India backend.
 *
 * All methods return the parsed JSON body. On non-2xx responses the body is
 * still returned (not thrown) so callers can inspect `res.success` and
 * `res.message` for user-facing error messages. A hard throw is reserved for
 * network failures where no body is available.
 *
 * Base URL is configured via NEXT_PUBLIC_API_URL (defaults to localhost:4000).
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/** Parse response JSON regardless of status code so error bodies are surfaced. */
async function parseResponse(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    // Non-JSON body (e.g. 502 from proxy) — wrap in standard shape
    return { success: false, message: text || `HTTP ${response.status}` };
  }
}

export class ApiClient {
  /**
   * Create request in agent_to_agent mode — evaluate + execute in one call.
   * On approval the response includes paymentExecuted: true and txId (paymentTxId).
   * On rejection the response includes paymentExecuted: false and decision details.
   */
  static async createRequestAuto(
    dataType: string,
    price: number,
    purpose: string,
    userWallet: string,
    companyWallet: string,
    companyMnemonic: string
  ) {
    const response = await fetch(`${API_BASE_URL}/request-data/auto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data_type:        dataType,
        price,
        purpose,
        user_wallet:      userWallet,
        company_wallet:   companyWallet,
        company_mnemonic: companyMnemonic
      })
    });
    return parseResponse(response);
  }

  /**
   * Create a new human_reviewed data request.
   * Returns { success, requestId, status }.
   */
  static async createRequest(dataType: string, price: number, purpose: string) {
    const response = await fetch(`${API_BASE_URL}/request-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data_type: dataType, price, purpose })
    });
    return parseResponse(response);
  }

  /**
   * Fetch a single DataRequest by ID.
   * Returns { success, request }.
   */
  static async getRequest(requestId: string) {
    const response = await fetch(`${API_BASE_URL}/request-data/${requestId}`);
    return parseResponse(response);
  }

  /**
   * Run the policy engine against a stored request and persist the decision.
   * Idempotent — calling it twice for the same request creates a second decision row
   * but the service always uses the most recent one.
   * Returns { success, decision, finalPrice, justification, confidence, riskLevel, ruleTriggers, evaluatedBy }.
   */
  static async getAgentDecision(requestId: string) {
    const response = await fetch(`${API_BASE_URL}/agent-decision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId })
    });
    return parseResponse(response);
  }

  /**
   * Execute the consent + payment flow on Algorand.
   * Returns the full proof result:
   *   { success, txId, paymentTxId, appCallTxId, explorerUrls,
   *     consentRecorded, paymentExecuted, usageConditionsHash, ... }
   */
  static async executeContract(
    userWallet: string,
    companyWallet: string,
    companyMnemonic: string,
    amount: number,
    requestId: string
  ) {
    const response = await fetch(`${API_BASE_URL}/execute-contract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userWallet, companyWallet, companyMnemonic, amount, requestId })
    });
    return parseResponse(response);
  }

  /**
   * Run a natural-language query against consent records, requests, or decisions.
   * Returns { success, interpretedIntent, filters, results, resultType, count }.
   */
  static async query(q: string) {
    const response = await fetch(`${API_BASE_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q })
    });
    return parseResponse(response);
  }

  /**
   * Fetch the persisted ConsentRecord for a request.
   * Returns { success, consentRecord }.
   */
  static async getConsentRecord(requestId: string) {
    const response = await fetch(`${API_BASE_URL}/consent-records/${requestId}`);
    return parseResponse(response);
  }

  /**
   * Fetch on-chain transaction details + linked ConsentRecord.
   * The :txId param is treated as a requestId by the backend — it looks up
   * the ConsentRecord by requestId and fetches the on-chain tx from there.
   * Returns { success, transaction, consentRecord }.
   */
  static async getTransactionDetails(txId: string) {
    const response = await fetch(`${API_BASE_URL}/execute-contract/${txId}`);
    return parseResponse(response);
  }

  /**
   * Fetch user data type preferences.
   * Returns { success, preferences: { [dataType]: 'allowed'|'restricted'|'blocked' } }
   */
  static async getDataPreferences(userWallet: string) {
    const response = await fetch(`${API_BASE_URL}/data-preferences/${encodeURIComponent(userWallet)}`);
    return parseResponse(response);
  }

  /**
   * Save user data type preferences.
   * Returns { success, preferences }
   */
  static async saveDataPreferences(userWallet: string, preferences: Record<string, string>) {
    const response = await fetch(`${API_BASE_URL}/data-preferences`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userWallet, preferences })
    });
    return parseResponse(response);
  }

  /**
   * Fetch total earnings and per-data-type earnings for a user wallet.
   * Returns { success, total: number, byDataType: Record<string, number> }
   */
  static async getEarnings(userWallet: string) {
    const response = await fetch(`${API_BASE_URL}/earnings/${encodeURIComponent(userWallet)}`);
    return parseResponse(response);
  }

  /**
   * Fetch global data value analytics across all approved consent records.
   * Returns {
   *   success, grandTotal, totalRecords, mostValuable, highestAvg,
   *   byDataType: { [type]: { dataType, totalEarnings, count, avgPrice, maxPrice, minPrice } },
   *   table: [...sorted by totalEarnings desc]
   * }
   */
  static async getAnalytics() {
    const response = await fetch(`${API_BASE_URL}/analytics`);
    return parseResponse(response);
  }

  /**
   * Fetch recent data access activity for a user wallet.
   * Returns { success, records: [{ requestId, companyWallet, dataType,
   *   consentStatus, price, timestamp, paymentTxId, appCallTxId, mode }] }
   */
  static async getRecentActivity(userWallet: string, limit = 10) {
    const response = await fetch(
      `${API_BASE_URL}/recent-activity/${encodeURIComponent(userWallet)}?limit=${limit}`
    );
    return parseResponse(response);
  }
}
