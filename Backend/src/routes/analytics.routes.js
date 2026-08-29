const express = require('express');
const router = express.Router();
const { getFinancialSummary } = require('../controllers/analytics.controller');
const { authenticate, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('ANALYTICS'));

router.get('/financial-summary', getFinancialSummary);

module.exports = router;
