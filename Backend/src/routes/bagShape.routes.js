const express = require('express');
const router = express.Router();
const { authenticate, checkTenantModule } = require('../middlewares/rbac.middleware');
const {
    createBagShape,
    getBagShapes,
    updateBagShape,
    deleteBagShape
} = require('../controllers/bagShape.controller');

router.use(authenticate);
router.use(checkTenantModule('MASTER_DATA'));

router.post('/', authenticate, createBagShape);
router.get('/', authenticate, getBagShapes);
router.put('/:id', authenticate, updateBagShape);
router.delete('/:id', authenticate, deleteBagShape);

module.exports = router;
