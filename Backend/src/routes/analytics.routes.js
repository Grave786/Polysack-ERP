const express = require('express');
const router = express.Router();
const { getFinancialSummary } = require('../controllers/analytics.controller');
const { authenticate } = require('../middlewares/rbac.middleware');

router.get('/financial-summary', authenticate, getFinancialSummary);

module.exports = router;
