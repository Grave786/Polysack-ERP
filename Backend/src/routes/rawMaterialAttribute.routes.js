const express = require('express');
const router = express.Router();
const { authenticate, checkTenantModule } = require('../middlewares/rbac.middleware');
const {
    createRawMaterialAttribute,
    getRawMaterialAttributes,
    updateRawMaterialAttribute,
    deleteRawMaterialAttribute
} = require('../controllers/rawMaterialAttribute.controller');

router.use(authenticate);
router.use(checkTenantModule('MASTER_DATA'));

router.post('/', createRawMaterialAttribute);
router.get('/', getRawMaterialAttributes);
router.put('/:id', updateRawMaterialAttribute);
router.delete('/:id', deleteRawMaterialAttribute);

module.exports = router;
