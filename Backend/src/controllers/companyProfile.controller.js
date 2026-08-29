const Tenant = require('../models/tenant.model');

/**
 * Whitelisted fields for Company Profile updates
 */
const ALLOWED_PROFILE_FIELDS = [
    'name',
    'companyName',
    'gstin',
    'stateCode',
    'stateName',
    'registeredAddress',
    'pan',
    'contactEmail',
    'contactPhone',
    'logoUrl',
    'productionSettings'
];

/**
 * Format clean Tenant Profile response payload
 */
const formatProfileResponse = (tenant) => {
    return {
        id: tenant._id,
        tenantName: tenant.name,
        companyName: tenant.companyName || tenant.name,
        email: tenant.email,
        phone: tenant.phone,
        gstin: tenant.gstin || null,
        stateCode: tenant.stateCode || null,
        stateName: tenant.stateName || null,
        registeredAddress: tenant.registeredAddress || { line1: '', line2: '', city: '', pincode: '' },
        pan: tenant.pan || null,
        contactEmail: tenant.contactEmail || tenant.email,
        contactPhone: tenant.contactPhone || tenant.phone,
        logoUrl: tenant.logoUrl || null,
        productionSettings: tenant.productionSettings || {
            activeStartingStage: 'FLEXO_PRINTING',
            stageConfigs: []
        },
        createdAt: tenant.createdAt,
        updatedAt: tenant.updatedAt
    };
};

/**
 * @desc    Get current Tenant's Company Profile & GST Settings
 * @route   GET /api/admin/company-profile
 * @access  Private (ADMINISTRATION / MASTER_DATA / USERS permission)
 */
const getCompanyProfile = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const tenant = await Tenant.findById(tenantId);
        if (!tenant || !tenant.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Tenant profile not found or account is inactive.'
            });
        }

        return res.status(200).json({
            success: true,
            data: formatProfileResponse(tenant)
        });
    } catch (error) {
        console.error('Error in getCompanyProfile:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve company profile.',
            error: error.message
        });
    }
};

/**
 * @desc    Update current Tenant's Company Profile & GST Settings
 * @route   PATCH /api/admin/company-profile
 * @access  Private (ADMINISTRATION / MASTER_DATA / USERS permission)
 */
const updateCompanyProfile = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Request body cannot be empty. Please provide profile fields to update.'
            });
        }

        // Whitelist updates
        const updateKeys = Object.keys(req.body).filter(key => ALLOWED_PROFILE_FIELDS.includes(key));
        if (updateKeys.length === 0) {
            return res.status(400).json({
                success: false,
                message: `No valid fields provided to update. Allowed fields: ${ALLOWED_PROFILE_FIELDS.join(', ')}`
            });
        }

        const tenant = await Tenant.findById(tenantId);
        if (!tenant || !tenant.isActive) {
            return res.status(404).json({
                success: false,
                message: 'Tenant profile not found or account is inactive.'
            });
        }

        // Validate format of GSTIN & PAN explicitly for clean 400 responses
        if (req.body.gstin !== undefined && req.body.gstin !== null && req.body.gstin.trim() !== '') {
            const cleanGstin = String(req.body.gstin).trim().toUpperCase();
            const gstinRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d[Z]{1}[A-Z\d]{1}$/;
            if (!gstinRegex.test(cleanGstin)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid GSTIN format. Must be 15 characters (e.g. 24AAAAA0000A1Z5).'
                });
            }

            const derivedStateCode = cleanGstin.substring(0, 2);
            const providedStateCode = req.body.stateCode ? String(req.body.stateCode).trim() : tenant.stateCode;

            if (providedStateCode && providedStateCode !== derivedStateCode) {
                return res.status(400).json({
                    success: false,
                    message: `GSTIN state code prefix ('${derivedStateCode}') contradicts the provided stateCode ('${providedStateCode}').`
                });
            }
            tenant.gstin = cleanGstin;
            tenant.stateCode = derivedStateCode;
        }

        if (req.body.pan !== undefined && req.body.pan !== null && req.body.pan.trim() !== '') {
            const cleanPan = String(req.body.pan).trim().toUpperCase();
            const panRegex = /^[A-Z]{5}\d{4}[A-Z]{1}$/;
            if (!panRegex.test(cleanPan)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid PAN format. Must be 10 characters (e.g. AAAAA0000A).'
                });
            }
            tenant.pan = cleanPan;
        }

        // Apply remaining whitelisted updates
        for (const key of updateKeys) {
            if (key === 'gstin' || key === 'pan') continue; // Already processed & validated above
            if (key === 'registeredAddress' && typeof req.body.registeredAddress === 'object') {
                tenant.registeredAddress = {
                    line1: req.body.registeredAddress.line1 !== undefined ? String(req.body.registeredAddress.line1).trim() : tenant.registeredAddress?.line1,
                    line2: req.body.registeredAddress.line2 !== undefined ? String(req.body.registeredAddress.line2).trim() : tenant.registeredAddress?.line2,
                    city: req.body.registeredAddress.city !== undefined ? String(req.body.registeredAddress.city).trim() : tenant.registeredAddress?.city,
                    pincode: req.body.registeredAddress.pincode !== undefined ? String(req.body.registeredAddress.pincode).trim() : tenant.registeredAddress?.pincode
                };
            } else if (key === 'productionSettings' && typeof req.body.productionSettings === 'object') {
                tenant.productionSettings = {
                    activeStartingStage: req.body.productionSettings.activeStartingStage || tenant.productionSettings?.activeStartingStage || 'FLEXO_PRINTING',
                    stageConfigs: Array.isArray(req.body.productionSettings.stageConfigs)
                        ? req.body.productionSettings.stageConfigs
                        : (tenant.productionSettings?.stageConfigs || [])
                };
            } else if (req.body[key] !== undefined) {
                tenant[key] = typeof req.body[key] === 'string' ? req.body[key].trim() : req.body[key];
            }
        }

        await tenant.save();

        return res.status(200).json({
            success: true,
            message: 'Company profile & GST settings updated successfully.',
            data: formatProfileResponse(tenant)
        });
    } catch (error) {
        console.error('Error in updateCompanyProfile:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update company profile.'
        });
    }
};

module.exports = {
    getCompanyProfile,
    updateCompanyProfile
};
