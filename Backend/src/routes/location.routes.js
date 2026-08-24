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
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/', authenticate, checkPermission('MASTER_DATA', 'READ'), getLocations);

/**
 * @route   GET /api/locations/:id
 * @desc    Get Location by ID
 * @access  Private (MASTER_DATA:READ)
 */
router.get('/:id', authenticate, checkPermission('MASTER_DATA', 'READ'), getLocationById);

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
router.delete('/:id', authenticate, checkPermission('MASTER_DATA', 'DELETE'), deleteLocation);

module.exports = router;
