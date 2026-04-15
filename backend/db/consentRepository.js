'use strict';

/**
 * consentRepository.js
 *
 * All Supabase access for the consent_records table.
 * Returns normalized domain objects — no raw rows leave this module.
 *
 * Audit trail role:
 *   Each row is the off-chain complement to the compact on-chain proof.
 *   The on-chain contract stores 5 fields: request_id, consent_status,
 *   price, usage_conditions_hash, timestamp.
 *   This table stores the full context: wallets, data type, purpose,
 *   both tx IDs (app call + payment), app ID, and mode.
 *
 *   The usage_conditions_hash links both records. Anyone can recompute it
 *   from the fields here to verify the on-chain proof independently.
 */

const supabase = require('./supabaseClient');

// ── Row mapping ───────────────────────────────────────────────────────────────

function toRow(r) {
  return {
    request_id:            r.requestId,
    user_wallet:           r.userWallet,
    company_wallet:        r.companyWallet,
    data_type:             r.dataType,
    purpose:               r.purpose,
    consent_status:        r.consentStatus,
    price:                 r.price,
    timestamp:             r.timestamp,
    usage_conditions_hash: r.usageConditionsHash,
    algorand_app_id:       r.algorandAppId  ?? null,
    app_call_tx_id:        r.appCallTxId    ?? null,
    payment_tx_id:         r.paymentTxId    ?? null,
    explorer_url:          r.explorerUrl    ?? null,
    mode:                  r.mode           ?? null
  };
}

function fromRow(row) {
  return {
    id:                   row.id,
    requestId:            row.request_id,
    userWallet:           row.user_wallet,
    companyWallet:        row.company_wallet,
    dataType:             row.data_type,
    purpose:              row.purpose,
    consentStatus:        row.consent_status,
    price:                Number(row.price),
    timestamp:            row.timestamp,
    usageConditionsHash:  row.usage_conditions_hash,
    algorandAppId:        row.algorand_app_id,
    appCallTxId:          row.app_call_tx_id,
    paymentTxId:          row.payment_tx_id,
    explorerUrl:          row.explorer_url,
    mode:                 row.mode,
    createdAt:            row.created_at
  };
}

function assert({ data, error }, ctx) {
  if (error) throw new Error(`[consentRepository:${ctx}] ${error.message}`);
  return data;
}

// ── Methods ───────────────────────────────────────────────────────────────────

/**
 * Persist a ConsentRecord.
 * @param {object} record
 * @returns {object} normalized domain object
 */
async function saveConsentRecord(record) {
  const result = await supabase
    .from('consent_records')
    .insert(toRow(record))
    .select()
    .single();
  return fromRow(assert(result, 'saveConsentRecord'));
}

/**
 * Fetch the most recent ConsentRecord for a request.
 * @param {string} requestId
 * @returns {object|null}
 */
async function getConsentRecordByRequestId(requestId) {
  const result = await supabase
    .from('consent_records')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = assert(result, 'getConsentRecordByRequestId');
  return row ? fromRow(row) : null;
}

/**
 * Fetch a ConsentRecord by its payment transaction ID.
 * Used when the caller only has the paymentTxId (e.g. from the frontend redirect).
 * @param {string} paymentTxId
 * @returns {object|null}
 */
async function getConsentRecordByPaymentTxId(paymentTxId) {
  const result = await supabase
    .from('consent_records')
    .select('*')
    .eq('payment_tx_id', paymentTxId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = assert(result, 'getConsentRecordByPaymentTxId');
  return row ? fromRow(row) : null;
}

/**
 * Flexible query over consent_records.
 * @param {object} [filters]
 * @param {string} [filters.consentStatus]
 * @param {string} [filters.dataType]
 * @param {string} [filters.userWallet]
 * @param {string} [filters.mode]
 * @param {number} [filters.limit]
 * @returns {object[]}
 */
async function queryConsentRecords({ consentStatus, dataType, userWallet, mode, limit = 50 } = {}) {
  let q = supabase
    .from('consent_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (consentStatus) q = q.eq('consent_status', consentStatus);
  if (dataType)      q = q.eq('data_type', dataType);
  if (userWallet)    q = q.eq('user_wallet', userWallet);
  if (mode)          q = q.eq('mode', mode);

  return assert(await q, 'queryConsentRecords').map(fromRow);
}

/**
 * Aggregate total earnings and per-data-type earnings for a user wallet.
 * Only counts approved consent records with a non-null price.
 *
 * @param {string} userWallet
 * @returns {{ total: number, byDataType: Record<string, number> }}
 */
async function getEarningsByWallet(userWallet) {
  const result = await supabase
    .from('consent_records')
    .select('data_type, price')
    .eq('user_wallet', userWallet)
    .eq('consent_status', 'approved');

  const rows = assert(result, 'getEarningsByWallet');
  const byDataType = {};
  let total = 0;

  for (const row of rows) {
    const amt = Number(row.price) || 0;
    total += amt;
    byDataType[row.data_type] = (byDataType[row.data_type] || 0) + amt;
  }

  return { total, byDataType };
}

/**
 * Compute data value analytics across all approved consent records.
 *
 * Calculations per data type:
 *   totalEarnings  = sum of price for all approved records of that type
 *   count          = number of approved records
 *   avgPrice       = totalEarnings / count  (rounded to 2 dp)
 *   maxPrice       = highest single payment
 *   minPrice       = lowest single payment
 *
 * Top-level:
 *   grandTotal     = sum across all types
 *   mostValuable   = data type with highest totalEarnings
 *   highestAvg     = data type with highest avgPrice (min 2 records)
 *   totalRecords   = total approved consent records
 *
 * @returns {Promise<object>}
 */
async function getDataValueAnalytics() {
  const result = await supabase
    .from('consent_records')
    .select('data_type, price')
    .eq('consent_status', 'approved');

  const rows = assert(result, 'getDataValueAnalytics');

  // Accumulate per-type stats
  const stats = {};
  for (const row of rows) {
    const type = row.data_type;
    const price = Number(row.price) || 0;
    if (!stats[type]) {
      stats[type] = { totalEarnings: 0, count: 0, maxPrice: 0, minPrice: Infinity };
    }
    stats[type].totalEarnings += price;
    stats[type].count         += 1;
    stats[type].maxPrice       = Math.max(stats[type].maxPrice, price);
    stats[type].minPrice       = Math.min(stats[type].minPrice, price);
  }

  // Compute derived fields
  const byDataType = {};
  for (const [type, s] of Object.entries(stats)) {
    byDataType[type] = {
      dataType:      type,
      totalEarnings: Math.round(s.totalEarnings * 100) / 100,
      count:         s.count,
      avgPrice:      s.count > 0 ? Math.round((s.totalEarnings / s.count) * 100) / 100 : 0,
      maxPrice:      s.maxPrice,
      minPrice:      s.minPrice === Infinity ? 0 : s.minPrice,
    };
  }

  const entries = Object.values(byDataType);
  const grandTotal   = entries.reduce((sum, e) => sum + e.totalEarnings, 0);
  const totalRecords = entries.reduce((sum, e) => sum + e.count, 0);

  // Most valuable = highest total earnings
  const mostValuable = entries.length > 0
    ? entries.reduce((best, e) => e.totalEarnings > best.totalEarnings ? e : best).dataType
    : null;

  // Highest average = highest avgPrice among types with at least 1 record
  const highestAvg = entries.length > 0
    ? entries.reduce((best, e) => e.avgPrice > best.avgPrice ? e : best).dataType
    : null;

  return {
    grandTotal:    Math.round(grandTotal * 100) / 100,
    totalRecords,
    mostValuable,
    highestAvg,
    byDataType,
    // Sorted table: highest total earnings first
    table: entries.sort((a, b) => b.totalEarnings - a.totalEarnings),
  };
}

module.exports = {
  saveConsentRecord,
  getConsentRecordByRequestId,
  getConsentRecordByPaymentTxId,
  queryConsentRecords,
  getEarningsByWallet,
  getDataValueAnalytics,
};
