const express = require('express');
const router = express.Router();

const requestController         = require('../controllers/requestController');
const agentController           = require('../controllers/agentController');
const contractController        = require('../controllers/contractController');
const queryController           = require('../controllers/queryController');
const dataPreferencesController = require('../controllers/dataPreferencesController');

// DataRequest routes
router.post('/request-data/auto', requestController.createAndExecuteRequest);  // agent_to_agent
router.post('/request-data', requestController.createRequest);
router.get('/request-data', requestController.getAllRequests);
router.get('/request-data/:id', requestController.getRequest);

// AgentDecision route
router.post('/agent-decision', agentController.evaluateDecision);

// ConsentRecord / contract execution routes
router.post('/execute-contract', contractController.executeContract);
router.get('/execute-contract/:txId', contractController.getTransactionDetails);
router.get('/consent-records', contractController.getAllConsentRecords);
router.get('/consent-records/:requestId', contractController.getConsentRecordByRequestId);

// Data preferences routes
router.get('/data-preferences/:userWallet', dataPreferencesController.getPreferences);
router.post('/data-preferences', dataPreferencesController.savePreferences);

// Earnings route
router.get('/earnings/:userWallet', dataPreferencesController.getEarnings);

// Data value analytics route (global — not per-wallet)
router.get('/analytics', dataPreferencesController.getAnalytics);

// Recent data access activity (per-wallet, latest first)
router.get('/recent-activity/:userWallet', dataPreferencesController.getRecentActivity);

// Query routes
router.post('/query', queryController.handleQuery);
router.post('/query-records', queryController.handleQuery);  // alias

module.exports = router;
