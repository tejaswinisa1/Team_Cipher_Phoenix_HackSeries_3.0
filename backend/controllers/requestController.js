'use strict';

/**
 * requestController.js
 *
 * HTTP handlers for DataRequest lifecycle.
 *
 * Routes:
 *   POST /api/request-data        — create a human_reviewed request
 *   GET  /api/request-data        — list all requests
 *   GET  /api/request-data/:id    — fetch a single request
 *   POST /api/request-data/auto   — agent_to_agent: create + evaluate + execute in one call
 *
 * All business logic lives in consentExecutionService and the policy engine.
 * These handlers are thin: validate → delegate → respond.
 */

const { createDataRequest } = require('../models');
const requestRepo           = require('../db/requestRepo');
const { executeConsentAuto } = require('../services/consentExecutionService');

// ── POST /api/request-data ────────────────────────────────────────────────────

/**
 * Create a new human_reviewed DataRequest.
 * Body: { data_type, price, purpose, company_name?, company_wallet?, user_wallet?, mode? }
 */
const createRequest = async (req, res) => {
  try {
    const { data_type, price, purpose, company_name, company_wallet, user_wallet, mode } = req.body;

    if (!data_type || !price || !purpose) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: data_type, price, purpose'
      });
    }
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ success: false, message: 'Price must be a positive number' });
    }
    if (mode && !['human_reviewed', 'agent_to_agent'].includes(mode)) {
      return res.status(400).json({
        success: false,
        message: 'mode must be "human_reviewed" or "agent_to_agent"'
      });
    }

    const request = createDataRequest({
      companyName:   company_name   || '',
      companyWallet: company_wallet || '',
      userWallet:    user_wallet    || '',
      dataType:      data_type,
      purpose,
      offeredPrice:  price,
      mode:          mode || 'human_reviewed'
    });

    await requestRepo.createRequest(request);
    console.log(`📝 Request created: ${request.id}`);

    return res.status(201).json({
      success:   true,
      requestId: request.id,
      status:    request.status,
      message:   'Data request created successfully'
    });
  } catch (error) {
    console.error('❌ Error creating request:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// ── GET /api/request-data/:id ─────────────────────────────────────────────────

const getRequest = async (req, res) => {
  try {
    const request = await requestRepo.getRequest(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    return res.status(200).json({ success: true, request });
  } catch (error) {
    console.error('❌ Error fetching request:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// ── GET /api/request-data ─────────────────────────────────────────────────────

const getAllRequests = async (_req, res) => {
  try {
    const requests = await requestRepo.getAllRequests();
    return res.status(200).json({ success: true, requests });
  } catch (error) {
    console.error('❌ Error fetching requests:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
};

// ── POST /api/request-data/auto ───────────────────────────────────────────────

/**
 * agent_to_agent mode: create request + policy evaluation + execution in one call.
 *
 * On approval:  returns full execution result including paymentTxId, explorerUrls, etc.
 * On rejection: returns decision result with paymentExecuted: false.
 *
 * Body: { data_type, price, purpose, company_wallet, user_wallet, company_mnemonic, company_name? }
 */
const createAndExecuteRequest = async (req, res) => {
  try {
    const {
      data_type, price, purpose,
      company_wallet, user_wallet, company_mnemonic,
      company_name
    } = req.body;

    if (!data_type || !price || !purpose || !company_wallet || !user_wallet || !company_mnemonic) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: data_type, price, purpose, company_wallet, user_wallet, company_mnemonic'
      });
    }
    if (typeof price !== 'number' || price <= 0) {
      return res.status(400).json({ success: false, message: 'Price must be a positive number' });
    }

    const request = createDataRequest({
      companyName:   company_name   || '',
      companyWallet: company_wallet,
      userWallet:    user_wallet,
      dataType:      data_type,
      purpose,
      offeredPrice:  price,
      mode:          'agent_to_agent'
    });

    await requestRepo.createRequest(request);
    console.log(`📝 [agent_to_agent] Request created: ${request.id}`);

    const result = await executeConsentAuto({
      requestId:       request.id,
      userWallet:      user_wallet,
      companyWallet:   company_wallet,
      companyMnemonic: company_mnemonic,
      amount:          price
    });

    // Expose paymentExecuted and txId at the top level for frontend routing
    return res.status(200).json({
      success:   true,
      requestId: request.id,
      // txId is the payment tx (used by frontend to navigate to /transaction/:txId)
      txId:      result.paymentTxId ?? null,
      ...result
    });
  } catch (error) {
    const status = error.statusCode || 500;
    console.error('❌ createAndExecuteRequest error:', error.message);
    return res.status(status).json({ success: false, message: error.message });
  }
};

module.exports = { createRequest, getRequest, getAllRequests, createAndExecuteRequest };
