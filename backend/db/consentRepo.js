/**
 * consentRepo.js
 * Data-access for the consent_records table.
 */

const supabase = require('./supabaseClient');

// ── Row mapping ───────────────────────────────────────────────────────────────

function toRow(record) {
  return {
    request_id:            record.requestId,
    user_wallet:           record.userWallet,
    company_wallet:        record.companyWallet,
    data_type:             record.dataType,
    purpose:               record.purpose,
    consent_status:        record.consentStatus,
    price:                 record.price,
    timestamp:             record.timestamp,
    usage_conditions_hash: record.usageConditionsHash,
    algorand_app_id:       record.algorandAppId,
    app_call_tx_id:        record.appCallTxId,
    payment_tx_id:         record.paymentTxId,
    explorer_url:          record.explorerUrl
  };
}

function fromRow(row) {
  return {
    requestId:            row.request_id,
    userWallet:           row.user_wallet,
    companyWallet:        row.company_wallet,
    dataType:             row.data_type,
    purpose:              row.purpose,
    consentStatus:        row.consent_status,
    price:                row.price,
    timestamp:            row.timestamp,
    usageConditionsHash:  row.usage_conditions_hash,
    algorandAppId:        row.algorand_app_id,
    appCallTxId:          row.app_call_tx_id,
    paymentTxId:          row.payment_tx_id,
    explorerUrl:          row.explorer_url
  };
}

function check({ data, error }, ctx) {
  if (error) throw new Error(`[consentRepo:${ctx}] ${error.message}`);
  return data;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Persist a ConsentRecord.
 * @param {object} record — ConsentRecord domain object
 * @returns {object} inserted row mapped back to domain shape
 */
async function saveConsent(record) {
  const result = await supabase
    .from('consent_records')
    .insert(toRow(record))
    .select()
    .single();
  return fromRow(check(result, 'saveConsent'));
}

/**
 * Fetch a ConsentRecord by payment transaction ID.
 * @param {string} paymentTxId
 * @returns {object|null}
 */
async function getConsent(paymentTxId) {
  const result = await supabase
    .from('consent_records')
    .select('*')
    .eq('payment_tx_id', paymentTxId)
    .maybeSingle();
  const row = check(result, 'getConsent');
  return row ? fromRow(row) : null;
}

/**
 * Fetch all ConsentRecords, newest first.
 * @returns {object[]}
 */
async function getAllConsents() {
  const result = await supabase
    .from('consent_records')
    .select('*')
    .order('timestamp', { ascending: false });
  return check(result, 'getAllConsents').map(fromRow);
}

module.exports = { saveConsent, getConsent, getAllConsents };
