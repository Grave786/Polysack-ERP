const Machine = require('../models/machine.model');
const UOM = require('../models/uom.model');
const Location = require('../models/location.model');
const { generateCsv, sendCsvResponse } = require('../utils/csvExport');

/**
 * @desc    Create a new Machine
 * @route   POST /api/machines
 * @access  Private (MASTER_DATA:CREATE permission)
 */
const createMachine = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        // Strip tenant from request body
        delete req.body.tenant;

        const {
            code,
            name,
            section,
            capacityPerHour,
            capacityUnit,
            defaultLocation,
            currentOperator,
            status,
            efficiency,
            isActive
        } = req.body;

        // 1. Validation
        if (!code || !name || !section) {
            return res.status(400).json({
                success: false,
                message: 'Please provide required fields: code, name, and section.'
            });
        }

        const formattedCode = String(code).trim().toUpperCase();
        const formattedName = String(name).trim();

        if (efficiency !== undefined) {
            const effNum = Number(efficiency);
            if (isNaN(effNum) || effNum < 0 || effNum > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Efficiency must be a number between 0 and 100.'
                });
            }
        }

        // 2. Validate tenant-ownership of referenced models
        if (capacityUnit) {
            const uomDoc = await UOM.findOne({ _id: capacityUnit, tenant: tenantId });
            if (!uomDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Capacity UOM does not exist or does not belong to your organization.'
                });
            }
        }

        if (defaultLocation) {
            const locationDoc = await Location.findOne({ _id: defaultLocation, tenant: tenantId });
            if (!locationDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Default location does not exist or does not belong to your organization.'
                });
            }
        }

        // 3. Duplicate checks
        const existingCode = await Machine.findOne({ code: formattedCode, tenant: tenantId });
        if (existingCode) {
            return res.status(400).json({
                success: false,
                message: `A Machine with code '${formattedCode}' already exists in your organization.`
            });
        }

        const existingName = await Machine.findOne({ name: formattedName, tenant: tenantId });
        if (existingName) {
            return res.status(400).json({
                success: false,
                message: `A Machine with name '${formattedName}' already exists in your organization.`
            });
        }

        // 4. Create Machine
        const machine = new Machine({
            code: formattedCode,
            name: formattedName,
            section,
            capacityPerHour: capacityPerHour !== undefined ? Number(capacityPerHour) : undefined,
            capacityUnit: capacityUnit || null,
            defaultLocation: defaultLocation || null,
            currentOperator,
            status: status || 'IDLE',
            efficiency: efficiency !== undefined ? Number(efficiency) : 0,
            isActive: isActive !== undefined ? isActive : true,
            tenant: tenantId
        });

        await machine.save();

        await machine.populate([
            { path: 'capacityUnit', select: 'name symbol type' },
            { path: 'defaultLocation', select: 'name code type' }
        ]);

        return res.status(201).json({
            success: true,
            message: 'Machine created successfully.',
            data: machine
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in createMachine:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create Machine.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all machines scoped to user's tenant
 * @route   GET /api/machines
 * @access  Private (MASTER_DATA:READ permission)
 */
const getMachines = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { section, status, isActive, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (section) {
            filter.section = section;
        }

        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') filter.isActive = true;
            else if (status === 'Inactive' || status === 'INACTIVE') filter.isActive = false;
            else filter.status = status;
        } else if (isActive !== undefined) {
            filter.isActive = isActive === 'true' || isActive === true;
        }

        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { currentOperator: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [machines, total] = await Promise.all([
            Machine.find(filter)
                .populate('capacityUnit', 'name symbol type')
                .populate('defaultLocation', 'name code type')
                .sort({ name: 1 })
                .skip(skip)
                .limit(limitNum),
            Machine.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: machines.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: machines
        });
    } catch (error) {
        console.error('Error in getMachines:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch machines.',
            error: error.message
        });
    }
};

/**
 * @desc    Export machines to CSV respecting tenant & query filters
 * @route   GET /api/machines/export
 * @access  Private (MASTER_DATA:READ permission)
 */
const exportMachines = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const { section, status, isActive, search } = req.query;
        const filter = { tenant: tenantId };

        if (section) filter.section = section;
        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') filter.isActive = true;
            else if (status === 'Inactive' || status === 'INACTIVE') filter.isActive = false;
            else filter.status = status;
        } else if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { currentOperator: { $regex: search, $options: 'i' } }
            ];
        }

        const machines = await Machine.find(filter).sort({ name: 1 });

        const fields = [
            { label: 'Machine Code', key: 'code' },
            { label: 'Machine Name', key: 'name' },
            { label: 'Section', key: (m) => m.section || '' },
            { label: 'Capacity Per Hour', key: (m) => m.capacityPerHour || '' },
            { label: 'Operator', key: (m) => m.currentOperator || '' },
            { label: 'Efficiency (%)', key: (m) => m.efficiency || 0 },
            { label: 'Status', key: (m) => m.status || 'AVAILABLE' },
            { label: 'Is Active', key: (m) => m.isActive !== false ? 'Active' : 'Inactive' }
        ];

        const csvContent = generateCsv(machines, fields);
        return sendCsvResponse(res, `machines_export_${Date.now()}.csv`, csvContent);
    } catch (error) {
        console.error('Error in exportMachines:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export machines to CSV.'
        });
    }
};

/**
 * @desc    Get machine by ID scoped to user's tenant
 * @route   GET /api/machines/:id
 * @access  Private (MASTER_DATA:READ permission)
 */
const getMachineById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const machine = await Machine.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('capacityUnit', 'name symbol type')
            .populate('defaultLocation', 'name code type');

        if (!machine) {
            return res.status(404).json({
                success: false,
                message: 'Machine not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: machine
        });
    } catch (error) {
        console.error('Error in getMachineById:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve machine.',
            error: error.message
        });
    }
};

/**
 * @desc    Update machine scoped to user's tenant
 * @route   PUT /api/machines/:id
 * @access  Private (MASTER_DATA:UPDATE permission)
 */
const updateMachine = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const machine = await Machine.findOne({ _id: req.params.id, tenant: tenantId });
        if (!machine) {
            return res.status(404).json({
                success: false,
                message: 'Machine not found.'
            });
        }

        delete req.body.tenant;

        const {
            code,
            name,
            section,
            capacityPerHour,
            capacityUnit,
            defaultLocation,
            currentOperator,
            status,
            efficiency,
            isActive
        } = req.body;

        if (efficiency !== undefined) {
            const effNum = Number(efficiency);
            if (isNaN(effNum) || effNum < 0 || effNum > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Efficiency must be a number between 0 and 100.'
                });
            }
            machine.efficiency = effNum;
        }

        if (code) {
            const formattedCode = String(code).trim().toUpperCase();
            if (formattedCode !== machine.code) {
                const existingCode = await Machine.findOne({
                    code: formattedCode,
                    tenant: tenantId,
                    _id: { $ne: machine._id }
                });
                if (existingCode) {
                    return res.status(400).json({
                        success: false,
                        message: `A Machine with code '${formattedCode}' already exists in your organization.`
                    });
                }
                machine.code = formattedCode;
            }
        }

        if (name && name.trim() !== machine.name) {
            const formattedName = name.trim();
            const existingName = await Machine.findOne({
                name: formattedName,
                tenant: tenantId,
                _id: { $ne: machine._id }
            });
            if (existingName) {
                return res.status(400).json({
                    success: false,
                    message: `A Machine with name '${formattedName}' already exists in your organization.`
                });
            }
            machine.name = formattedName;
        }

        if (capacityUnit !== undefined) {
            if (capacityUnit) {
                const uomDoc = await UOM.findOne({ _id: capacityUnit, tenant: tenantId });
                if (!uomDoc) {
                    return res.status(400).json({
                        success: false,
                        message: 'Capacity UOM does not exist or does not belong to your organization.'
                    });
                }
                machine.capacityUnit = capacityUnit;
            } else {
                machine.capacityUnit = null;
            }
        }

        if (defaultLocation !== undefined) {
            if (defaultLocation) {
                const locationDoc = await Location.findOne({ _id: defaultLocation, tenant: tenantId });
                if (!locationDoc) {
                    return res.status(400).json({
                        success: false,
                        message: 'Default location does not exist or does not belong to your organization.'
                    });
                }
                machine.defaultLocation = defaultLocation;
            } else {
                machine.defaultLocation = null;
            }
        }

        if (section) machine.section = section;
        if (capacityPerHour !== undefined) machine.capacityPerHour = Number(capacityPerHour);
        if (currentOperator !== undefined) machine.currentOperator = currentOperator;
        if (status) machine.status = status;
        if (isActive !== undefined) machine.isActive = isActive;

        await machine.save();

        await machine.populate([
            { path: 'capacityUnit', select: 'name symbol type' },
            { path: 'defaultLocation', select: 'name code type' }
        ]);

        return res.status(200).json({
            success: true,
            message: 'Machine updated successfully.',
            data: machine
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in updateMachine:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update Machine.',
            error: error.message
        });
    }
};

/**
 * @desc    Soft delete Machine (isActive: false) scoped to user's tenant
 * @route   DELETE /api/machines/:id
 * @access  Private (MASTER_DATA:DELETE permission)
 */
const deleteMachine = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const machine = await Machine.findOne({ _id: req.params.id, tenant: tenantId });
        if (!machine) {
            return res.status(404).json({
                success: false,
                message: 'Machine not found.'
            });
        }

        machine.isActive = false;
        await machine.save();

        return res.status(200).json({
            success: true,
            message: 'Machine deactivated successfully.',
            data: machine
        });
    } catch (error) {
        console.error('Error in deleteMachine:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete Machine.',
            error: error.message
        });
    }
};

module.exports = {
    createMachine,
    getMachines,
    exportMachines,
    getMachineById,
    updateMachine,
    deleteMachine
};
