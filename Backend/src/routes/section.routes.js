const express = require('express');
const router = express.Router();
const { authenticate, checkTenantModule } = require('../middlewares/rbac.middleware');
const {
    createSection,
    getSections,
    updateSection,
    deleteSection
} = require('../controllers/section.controller');

router.use(authenticate);
router.use(checkTenantModule('MASTER_DATA'));

router.post('/', authenticate, createSection);
router.get('/', authenticate, getSections);
router.put('/:id', authenticate, updateSection);
router.delete('/:id', authenticate, deleteSection);

module.exports = router;
