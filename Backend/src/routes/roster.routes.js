const express = require('express');
const router = express.Router();
const { createRoster, getRosters, deleteRoster } = require('../controllers/roster.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

router.use(authenticate);
router.use(checkTenantModule('HR'));

router.post('/', authenticate, checkPermission('HR', 'CREATE'), createRoster);
router.get('/', authenticate, checkPermission('HR', 'READ'), getRosters);
const Roster = require('../models/roster.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

router.delete('/:id', authenticate, checkPermission('HR', 'DELETE'), deleteRoster);
router.post('/bulk-delete', authenticate, checkPermission('HR', 'DELETE'), createBulkDeleteHandler(Roster, { resourceName: 'Rosters' }));

module.exports = router;
