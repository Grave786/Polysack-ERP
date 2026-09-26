const express = require('express');
const router = express.Router();
const CustomerInteraction = require('../models/customerInteraction.model');
const Complaint = require('../models/complaint.model');
const OrderEnquiry = require('../models/orderEnquiry.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');
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
    deleteComplaint,

    // Order Enquiries
    createOrderEnquiry,
    getOrderEnquiries,
    getOrderEnquiryById,
    updateOrderEnquiry,
    deleteOrderEnquiry,
    addFollowUp,
    updateSOApprovalStatus
} = require('../controllers/crm.controller');
const { authenticate, checkPermission, checkTenantModule } = require('../middlewares/rbac.middleware');

// Protect all CRM routes with authentication and tenant CRM module entitlement
router.use(authenticate);
router.use(checkTenantModule('CRM'));

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

/**
 * @route   POST /api/crm/interactions/bulk-delete
 * @desc    Bulk Soft Delete Customer Interactions
 * @access  Private (SALES:DELETE)
 */
router.post('/interactions/bulk-delete', authenticate, checkPermission('SALES', 'DELETE'), createBulkDeleteHandler(CustomerInteraction, { resourceName: 'CRM Interactions' }));

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

/**
 * @route   POST /api/crm/complaints/bulk-delete
 * @desc    Bulk Soft Delete Complaints
 * @access  Private (SALES:DELETE)
 */
router.post('/complaints/bulk-delete', authenticate, checkPermission('SALES', 'DELETE'), createBulkDeleteHandler(Complaint, { resourceName: 'CRM Complaints' }));

// ==========================================
// 3. ORDER ENQUIRY ROUTES
// ==========================================

/**
 * @route   POST /api/crm/enquiries
 * @desc    Create a new Order Enquiry
 * @access  Private (SALES:CREATE)
 */
router.post('/enquiries', authenticate, checkPermission('SALES', 'CREATE'), createOrderEnquiry);

/**
 * @route   GET /api/crm/enquiries
 * @desc    Get Order Enquiries list
 * @access  Private (SALES:READ)
 */
router.get('/enquiries', authenticate, checkPermission('SALES', 'READ'), getOrderEnquiries);

/**
 * @route   GET /api/crm/enquiries/:id
 * @desc    Get Order Enquiry by ID
 * @access  Private (SALES:READ)
 */
router.get('/enquiries/:id', authenticate, checkPermission('SALES', 'READ'), getOrderEnquiryById);

/**
 * @route   PUT /api/crm/enquiries/:id
 * @desc    Update Order Enquiry
 * @access  Private (SALES:UPDATE)
 */
router.put('/enquiries/:id', authenticate, checkPermission('SALES', 'UPDATE'), updateOrderEnquiry);

/**
 * @route   POST /api/crm/enquiries/:id/follow-ups
 * @desc    Add Follow-up to Order Enquiry
 * @access  Private (SALES:UPDATE)
 */
router.post('/enquiries/:id/follow-ups', authenticate, checkPermission('SALES', 'UPDATE'), addFollowUp);
router.post('/enquiries/:id/follow-up', authenticate, checkPermission('SALES', 'UPDATE'), addFollowUp);
router.post('/:id/follow-up', authenticate, checkPermission('SALES', 'UPDATE'), addFollowUp);
router.post('/:id/follow-ups', authenticate, checkPermission('SALES', 'UPDATE'), addFollowUp);

/**
 * @route   PATCH /api/crm/enquiries/:id/so-approval-status
 * @route   PUT /api/crm/enquiries/:id/so-approval-status
 * @desc    Update SO Approval Status for Order Enquiry
 * @access  Private (SALES:UPDATE)
 */
router.patch('/enquiries/:id/so-approval-status', authenticate, checkPermission('SALES', 'UPDATE'), updateSOApprovalStatus);
router.put('/enquiries/:id/so-approval-status', authenticate, checkPermission('SALES', 'UPDATE'), updateSOApprovalStatus);
router.patch('/:id/so-approval-status', authenticate, checkPermission('SALES', 'UPDATE'), updateSOApprovalStatus);
router.put('/:id/so-approval-status', authenticate, checkPermission('SALES', 'UPDATE'), updateSOApprovalStatus);
router.patch('/enquiries/:id/approval', authenticate, checkPermission('SALES', 'UPDATE'), updateSOApprovalStatus);
router.put('/enquiries/:id/approval', authenticate, checkPermission('SALES', 'UPDATE'), updateSOApprovalStatus);

/**
 * @route   DELETE /api/crm/enquiries/:id
 * @desc    Soft Delete Order Enquiry
 * @access  Private (SALES:DELETE)
 */
router.delete('/enquiries/:id', authenticate, checkPermission('SALES', 'DELETE'), deleteOrderEnquiry);

/**
 * @route   POST /api/crm/enquiries/bulk-delete
 * @desc    Bulk Soft Delete Order Enquiries
 * @access  Private (SALES:DELETE)
 */
router.post('/enquiries/bulk-delete', authenticate, checkPermission('SALES', 'DELETE'), createBulkDeleteHandler(OrderEnquiry, { resourceName: 'Order Enquiries' }));

module.exports = router;
