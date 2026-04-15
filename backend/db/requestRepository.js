/**
 * requestRepository.js
 * All Supabase access for the data_requests table.
 * Returns normalized domain objects — no raw rows leave this module.
 */

const supabase = require('./supabaseClient');

// ── Mapping ───────────────────────────────────────────────────────────────────

function toRow(r) {
  return {
    id:            r.id,
    company_name:  r.companyName  || '',
    company_wallet: r.companyWallet || '',
    user_wallet:   r.userWallet   || '',
    data_type:     r.dataType,
    purpose:       r.purpose,
    offered_price: r.offeredPrice,
    mode:          r.mode         || 'human_reviewed',
    status:        r.status       || 'pending',
    created_at:    r.createdAt    || new Date().toISOString()
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
    offeredPrice:  Number(row.offered_price),
    mode:          row.mode,
    status:        row.status,
    createdAt:     row.created_at
  };
}

function assert({ data, error }, ctx) {
  if (error) throw new Error(`[requestRepository:${ctx}] ${error.message}`);
  return data;
}

// ── Methods ───────────────────────────────────────────────────────────────────

async function createRequest(request) {
  const result = await supabase
    .from('data_requests')
    .insert(toRow(request))
    .select()
    .single();
  return fromRow(assert(result, 'createRequest'));
}

async function getRequestById(id) {
  const result = await supabase
    .from('data_requests')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  const row = assert(result, 'getRequestById');
  return row ? fromRow(row) : null;
}

/**
 * List requests with optional filters.
 * @param {object} [filters]
 * @param {string} [filters.status]
 * @param {string} [filters.mode]
 * @param {number} [filters.limit]
 * @returns {object[]}
 */
async function listRequests({ status, mode, limit = 100 } = {}) {
  let q = supabase
    .from('data_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) q = q.eq('status', status);
  if (mode)   q = q.eq('mode', mode);

  return assert(await q, 'listRequests').map(fromRow);
}

async function updateStatus(id, status) {
  const result = await supabase
    .from('data_requests')
    .update({ status })
    .eq('id', id);
  assert(result, 'updateStatus');
}

module.exports = { createRequest, getRequestById, listRequests, updateStatus };
