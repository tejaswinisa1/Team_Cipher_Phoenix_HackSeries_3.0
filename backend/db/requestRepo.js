/**
 * requestRepo.js
 * Data-access for the data_requests table.
 */

const supabase = require('./supabaseClient');

// ── Row mapping ───────────────────────────────────────────────────────────────

function toRow(request) {
  return {
    id:             request.id,
    company_name:   request.companyName,
    company_wallet: request.companyWallet,
    user_wallet:    request.userWallet,
    data_type:      request.dataType,
    purpose:        request.purpose,
    offered_price:  request.offeredPrice,
    mode:           request.mode,
    status:         request.status,
    created_at:     request.createdAt
  };
}

function fromRow(row) {
  return {
    id:            row.id,
    companyName:   row.company_name,
    companyWallet: row.company_wallet,
    userWallet:    row.user_wallet,
    dataType:      row.data_type,
    purpose:       row.purpose,
    offeredPrice:  row.offered_price,
    mode:          row.mode,
    status:        row.status,
    createdAt:     row.created_at
  };
}

function check({ data, error }, ctx) {
  if (error) throw new Error(`[requestRepo:${ctx}] ${error.message}`);
  return data;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Persist a new DataRequest.
 * @param {object} request — DataRequest domain object
 * @returns {object} inserted row mapped back to domain shape
 */
async function createRequest(request) {
  const result = await supabase
    .from('data_requests')
    .insert(toRow(request))
    .select()
    .single();
  return fromRow(check(result, 'createRequest'));
}

/**
 * Fetch a single DataRequest by id.
 * @param {string} id
 * @returns {object|null}
 */
async function getRequest(id) {
  const result = await supabase
    .from('data_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const row = check(result, 'getRequest');
  return row ? fromRow(row) : null;
}

/**
 * Fetch all DataRequests, newest first.
 * @returns {object[]}
 */
async function getAllRequests() {
  const result = await supabase
    .from('data_requests')
    .select('*')
    .order('created_at', { ascending: false });
  return check(result, 'getAllRequests').map(fromRow);
}

/**
 * Update the status field of a DataRequest.
 * @param {string} id
 * @param {string} status
 */
async function updateStatus(id, status) {
  const result = await supabase
    .from('data_requests')
    .update({ status })
    .eq('id', id);
  check(result, 'updateStatus');
}

module.exports = { createRequest, getRequest, getAllRequests, updateStatus };
