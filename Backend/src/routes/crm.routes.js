const express = require('express');
const router = express.Router();
const {
    // Interactions
    createInteraction,
    getInteractions,
    exportInteractionsCsv,
    getInteractionById,
    updateInteraction,
    deleteInteraction,

    // Complaints
    createComplaint,
    getComplaints,
    exportComplaintsCsv,
    getComplaintById,
    updateComplaint,
    deleteComplaint
} = require('../controllers/crm.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

// ==========================================
// 1. CUSTOMER INTERACTIONS ROUTES
// ==========================================

/**
 * @route   POST /api/crm/interactions
 * @desc    Log Customer Interaction / Follow-up
 * @access  Private (SALES:CREATE)
 */
router.post('/interactions', authenticate, checkPermission('SALES', 'CREATE'), createInteraction);

/**
 * @route   GET /api/crm/interactions
 * @desc    Get Customer Interactions list
 * @access  Private (SALES:READ)
 */
router.get('/interactions', authenticate, checkPermission('SALES', 'READ'), getInteractions);

/**
 * @route   GET /api/crm/interactions/export-csv
 * @desc    Export Customer Interactions to CSV
 * @access  Private (SALES:READ)
 */
router.get('/interactions/export-csv', authenticate, checkPermission('SALES', 'READ'), exportInteractionsCsv);

/**
 * @route   GET /api/crm/interactions/:id
 * @desc    Get Customer Interaction by ID
 * @access  Private (SALES:READ)
 */
router.get('/interactions/:id', authenticate, checkPermission('SALES', 'READ'), getInteractionById);

/**
 * @route   PUT /api/crm/interactions/:id
 * @desc    Update Customer Interaction
 * @access  Private (SALES:UPDATE)
 */
router.put('/interactions/:id', authenticate, checkPermission('SALES', 'UPDATE'), updateInteraction);

/**
 * @route   DELETE /api/crm/interactions/:id
 * @desc    Soft Delete Customer Interaction
 * @access  Private (SALES:DELETE)
 */
router.delete('/interactions/:id', authenticate, checkPermission('SALES', 'DELETE'), deleteInteraction);

// ==========================================
// 2. CUSTOMER COMPLAINTS ROUTES
// ==========================================

/**
 * @route   POST /api/crm/complaints
 * @desc    Log Quality & Delivery Complaint
 * @access  Private (SALES:CREATE)
 */
router.post('/complaints', authenticate, checkPermission('SALES', 'CREATE'), createComplaint);

/**
 * @route   GET /api/crm/complaints
 * @desc    Get Complaints list
 * @access  Private (SALES:READ)
 */
router.get('/complaints', authenticate, checkPermission('SALES', 'READ'), getComplaints);

/**
 * @route   GET /api/crm/complaints/export-csv
 * @desc    Export Complaints to CSV
 * @access  Private (SALES:READ)
 */
router.get('/complaints/export-csv', authenticate, checkPermission('SALES', 'READ'), exportComplaintsCsv);

/**
 * @route   GET /api/crm/complaints/:id
 * @desc    Get Complaint by ID
 * @access  Private (SALES:READ)
 */
router.get('/complaints/:id', authenticate, checkPermission('SALES', 'READ'), getComplaintById);

/**
 * @route   PUT /api/crm/complaints/:id
 * @desc    Update Complaint details and status
 * @access  Private (SALES:UPDATE)
 */
router.put('/complaints/:id', authenticate, checkPermission('SALES', 'UPDATE'), updateComplaint);

/**
 * @route   DELETE /api/crm/complaints/:id
 * @desc    Soft Delete Complaint
 * @access  Private (SALES:DELETE)
 */
router.delete('/complaints/:id', authenticate, checkPermission('SALES', 'DELETE'), deleteComplaint);

module.exports = router;
