const express = require('express');
const router = express.Router();
const { createRoster, getRosters, deleteRoster } = require('../controllers/roster.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

router.post('/', authenticate, checkPermission('USERS', 'CREATE'), createRoster);
router.get('/', authenticate, checkPermission('USERS', 'READ'), getRosters);
router.delete('/:id', authenticate, checkPermission('USERS', 'DELETE'), deleteRoster);

module.exports = router;
