'use strict';

const { runQuery } = require('../services/queryService');

/**
 * POST /api/query  (also aliased as POST /api/query-records)
 * Body: { query: string }
 *
 * Response: { success, interpretedIntent, filters, results, resultType, count }
 */
const handleQuery = async (req, res) => {
  try {
    const { query } = req.body;
    if (!query || typeof query !== 'string' || !query.trim()) {
      return res.status(400).json({ success: false, message: 'Missing required field: query' });
    }

    const result = await runQuery(query.trim());

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    const status = error.statusCode || 500;
    console.error(`[queryController] ${error.message}`);
    return res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = { handleQuery };
