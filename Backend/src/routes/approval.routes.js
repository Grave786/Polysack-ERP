const express = require('express');
const router = express.Router();
const {
    getApprovals,
    getPendingCount,
    getApprovalById,
    approveApproval,
    rejectApproval,
    cancelApproval
} = require('../controllers/approval.controller');
const { authenticate, requireApprovalPermission } = require('../middlewares/rbac.middleware');

router.use(authenticate, requireApprovalPermission);

// ── GET routes ──────────────────────────────────────────────────────────────
router.get('/', getApprovals);
router.get('/pending-count', getPendingCount);
router.get('/:id', getApprovalById);

// ── Action routes ───────────────────────────────────────────────────────────
router.post('/:id/approve', approveApproval);
router.post('/:id/reject', rejectApproval);
router.post('/:id/cancel', cancelApproval);

module.exports = router;
