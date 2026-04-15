'use strict';

/**
 * dataPreferencesController.js
 *
 * Manages per-user data type preferences (allowed / restricted / blocked).
 * Preferences are stored in Supabase `user_data_preferences` table keyed by
 * user_wallet. If the table doesn't exist yet, operations degrade gracefully.
 *
 * Preference values:
 *   'allowed'    — data type can be shared normally
 *   'restricted' — data type can be shared but policy engine raises riskLevel
 *   'blocked'    — data type is always rejected regardless of price
 *
 * Routes:
 *   GET  /api/data-preferences/:userWallet   — fetch preferences
 *   POST /api/data-preferences               — save preferences
 *   GET  /api/earnings/:userWallet           — total + per-type earnings
 */

const supabase = require('../db/supabaseClient');
const { getEarningsByWallet, getDataValueAnalytics, queryConsentRecords } = require('../db/consentRepository');

// Default preferences — all data types allowed unless user changes them
const DEFAULT_PREFERENCES = {
  location:    'allowed',
  browsing:    'allowed',
  purchase:    'allowed',
  behavior:    'allowed',
  demographic: 'allowed',
  health:      'blocked',    // sensitive — blocked by default
  financial:   'blocked',    // sensitive — blocked by default
};

// ── GET /api/data-preferences/:userWallet ─────────────────────────────────────

const getPreferences = async (req, res) => {
  try {
    const { userWallet } = req.params;
    if (!userWallet) {
      return res.status(400).json({ success: false, message: 'Missing userWallet' });
    }

    const { data, error } = await supabase
      .from('user_data_preferences')
      .select('preferences')
      .eq('user_wallet', userWallet)
      .maybeSingle();

    if (error) {
      // Table may not exist yet — return defaults gracefully
      console.warn(`[dataPreferencesController] Supabase error (returning defaults): ${error.message}`);
      return res.status(200).json({ success: true, preferences: DEFAULT_PREFERENCES, source: 'default' });
    }

    const preferences = data?.preferences ?? DEFAULT_PREFERENCES;
    return res.status(200).json({ success: true, preferences, source: data ? 'db' : 'default' });
  } catch (err) {
    console.error(`[dataPreferencesController] getPreferences error: ${err.message}`);
    return res.status(200).json({ success: true, preferences: DEFAULT_PREFERENCES, source: 'default' });
  }
};

// ── POST /api/data-preferences ────────────────────────────────────────────────

const savePreferences = async (req, res) => {
  try {
    const { userWallet, preferences } = req.body;
    if (!userWallet || !preferences) {
      return res.status(400).json({ success: false, message: 'Missing userWallet or preferences' });
    }

    // Validate preference values
    const valid = ['allowed', 'restricted', 'blocked'];
    for (const [key, val] of Object.entries(preferences)) {
      if (!valid.includes(val)) {
        return res.status(400).json({
          success: false,
          message: `Invalid preference value "${val}" for "${key}". Must be: allowed, restricted, or blocked`
        });
      }
    }

    const { error } = await supabase
      .from('user_data_preferences')
      .upsert({ user_wallet: userWallet, preferences, updated_at: new Date().toISOString() }, { onConflict: 'user_wallet' });

    if (error) {
      console.warn(`[dataPreferencesController] Supabase upsert error: ${error.message}`);
      // Don't fail — preferences will fall back to localStorage on the client
      return res.status(200).json({ success: true, message: 'Saved (client-side fallback active)', preferences });
    }

    console.log(`[dataPreferencesController] Preferences saved for wallet: ${userWallet}`);
    return res.status(200).json({ success: true, message: 'Preferences saved', preferences });
  } catch (err) {
    console.error(`[dataPreferencesController] savePreferences error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/earnings/:userWallet ─────────────────────────────────────────────

const getEarnings = async (req, res) => {
  try {
    const { userWallet } = req.params;
    if (!userWallet) {
      return res.status(400).json({ success: false, message: 'Missing userWallet' });
    }

    const earnings = await getEarningsByWallet(userWallet);
    return res.status(200).json({ success: true, ...earnings });
  } catch (err) {
    console.error(`[dataPreferencesController] getEarnings error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/analytics ───────────────────────────────────────────────────────

/**
 * Compute and return data value analytics across all approved consent records.
 *
 * Response shape:
 *   {
 *     success: true,
 *     grandTotal: number,       — total ALGO paid across all records
 *     totalRecords: number,     — count of approved consent records
 *     mostValuable: string,     — data type with highest total earnings
 *     highestAvg: string,       — data type with highest average price
 *     byDataType: { [type]: { dataType, totalEarnings, count, avgPrice, maxPrice, minPrice } },
 *     table: [...sorted by totalEarnings desc]
 *   }
 */
const getAnalytics = async (_req, res) => {
  try {
    const analytics = await getDataValueAnalytics();
    return res.status(200).json({ success: true, ...analytics });
  } catch (err) {
    console.error(`[dataPreferencesController] getAnalytics error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
};

// ── GET /api/recent-activity/:userWallet ─────────────────────────────────────

/**
 * Return the most recent consent records for a user wallet.
 * Includes all statuses (approved + rejected) so the user sees the full picture.
 *
 * Query params:
 *   limit  — number of records to return (default 10, max 20)
 *
 * Response shape:
 *   { success: true, records: [{ requestId, companyWallet, dataType,
 *       consentStatus, price, timestamp, paymentTxId, appCallTxId }] }
 */
const getRecentActivity = async (req, res) => {
  try {
    const { userWallet } = req.params;
    if (!userWallet) {
      return res.status(400).json({ success: false, message: 'Missing userWallet' });
    }

    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20);

    const records = await queryConsentRecords({ userWallet, limit });

    // Return only the fields the frontend needs — no sensitive company mnemonics
    const activity = records.map(r => ({
      requestId:     r.requestId,
      companyWallet: r.companyWallet,
      dataType:      r.dataType,
      purpose:       r.purpose,
      consentStatus: r.consentStatus,
      price:         r.price,
      timestamp:     r.timestamp,
      paymentTxId:   r.paymentTxId,
      appCallTxId:   r.appCallTxId,
      mode:          r.mode,
    }));

    return res.status(200).json({ success: true, records: activity });
  } catch (err) {
    console.error(`[dataPreferencesController] getRecentActivity error: ${err.message}`);
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { getPreferences, savePreferences, getEarnings, getAnalytics, getRecentActivity, DEFAULT_PREFERENCES };
