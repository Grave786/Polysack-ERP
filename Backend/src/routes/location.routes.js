const express = require('express');
const router = express.Router();
const {
    createLocation,
    getLocations,
    getLocationById,
    updateLocation,
    deleteLocation
} = require('../controllers/location.controller');
const { authenticate, checkPermission } = require('../middlewares/rbac.middleware');

/**
 * @route   POST /api/locations
 * @desc    Create a new Location / Facility
 * @access  Private (MASTER_DATA:CREATE)
 */
router.post('/', authenticate, checkPermission('MASTER_DATA', 'CREATE'), createLocation);

/**
 * @route   GET /api/locations
 * @desc    Get all Locations for current tenant
 * @access  Private (Authenticated users)
 */
router.get('/', authenticate, getLocations);

/**
 * @route   GET /api/locations/:id
 * @desc    Get Location by ID
 * @access  Private (Authenticated users)
 */
router.get('/:id', authenticate, getLocationById);

/**
 * @route   PUT /api/locations/:id
 * @desc    Update Location by ID
 * @access  Private (MASTER_DATA:UPDATE)
 */
router.put('/:id', authenticate, checkPermission('MASTER_DATA', 'UPDATE'), updateLocation);

/**
 * @route   DELETE /api/locations/:id
 * @desc    Soft delete Location by ID
 * @access  Private (MASTER_DATA:DELETE)
 */
const Location = require('../models/location.model');
const { createBulkDeleteHandler } = require('../utils/bulkDeleteHelper');

router.delete('/:id', authenticate, checkPermission('MASTER_DATA', 'DELETE'), deleteLocation);

/**
 * @route   POST /api/locations/bulk-delete
 * @desc    Bulk soft delete Locations
 * @access  Private (MASTER_DATA:DELETE)
 */
router.post('/bulk-delete', authenticate, checkPermission('MASTER_DATA', 'DELETE'), createBulkDeleteHandler(Location, { resourceName: 'Locations' }));

module.exports = router;
