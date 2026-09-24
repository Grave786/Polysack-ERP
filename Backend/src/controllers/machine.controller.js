const mongoose = require('mongoose');
const Machine = require('../models/machine.model');
const Employee = require('../models/employee.model');
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
            plantLocation,
            capacityPerHour,
            capacityUnit,
            defaultLocation,
            currentOperator,
            currentOperators,
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

        const formattedSection = String(section || 'Extrusion').trim();
        const formattedStatus = String(status || 'Available').trim();

        // Resolve currentOperators (or legacy currentOperator) from Employee ObjectId or Employee Code / Name
        const rawOpsInput = currentOperators !== undefined ? currentOperators : (currentOperator ? [currentOperator] : []);
        const rawOpsArray = Array.isArray(rawOpsInput) ? rawOpsInput : [rawOpsInput];
        const resolvedOperatorIds = [];

        for (const op of rawOpsArray) {
            if (!op) continue;
            if (mongoose.Types.ObjectId.isValid(op) && String(new mongoose.Types.ObjectId(op)) === String(op)) {
                const emp = await Employee.findOne({ _id: op, tenant: tenantId });
                if (emp && !resolvedOperatorIds.some((id) => String(id) === String(emp._id))) {
                    resolvedOperatorIds.push(emp._id);
                }
            } else if (typeof op === 'string' && op.trim()) {
                const emp = await Employee.findOne({
                    tenant: tenantId,
                    $or: [
                        { employeeCode: op.trim().toUpperCase() },
                        { name: op.trim() }
                    ]
                });
                if (emp && !resolvedOperatorIds.some((id) => String(id) === String(emp._id))) {
                    resolvedOperatorIds.push(emp._id);
                }
            }
        }
        const resolvedPrimaryOperatorId = resolvedOperatorIds[0] || null;

        let resolvedPlantLocation = plantLocation ? String(plantLocation).trim() : '';
        let resolvedDefaultLocation = defaultLocation || null;

        if (plantLocation && mongoose.Types.ObjectId.isValid(plantLocation)) {
            const locDoc = await Location.findOne({ _id: plantLocation, tenant: tenantId });
            if (locDoc) {
                resolvedPlantLocation = locDoc.name;
                resolvedDefaultLocation = locDoc._id;
            }
        }

        // 4. Create Machine
        const machine = new Machine({
            code: formattedCode,
            name: formattedName,
            section: formattedSection,
            plantLocation: resolvedPlantLocation,
            capacityPerHour: capacityPerHour !== undefined ? Number(capacityPerHour) : undefined,
            capacityUnit: capacityUnit || null,
            defaultLocation: resolvedDefaultLocation,
            currentOperators: resolvedOperatorIds,
            currentOperator: resolvedPrimaryOperatorId,
            status: formattedStatus,
            efficiency: efficiency !== undefined ? Number(efficiency) : 0,
            isActive: isActive !== undefined ? isActive : true,
            tenant: tenantId
        });

        await machine.save();

        await machine.populate([
            { path: 'capacityUnit', select: 'name symbol type' },
            { path: 'defaultLocation', select: 'name code type' },
            { path: 'currentOperators', select: 'name employeeCode department' },
            { path: 'currentOperator', select: 'name employeeCode department' }
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

        if (status && status !== 'All' && status !== 'ALL' && status !== 'All Statuses') {
            if (status === 'Active' || status === 'ACTIVE') {
                filter.isActive = true;
            } else if (status === 'Inactive' || status === 'INACTIVE') {
                filter.isActive = false;
            } else {
                const regexPattern = status.replace(/_/g, '[\\s_]').replace(/\s+/g, '[\\s_]');
                filter.status = { $regex: `^${regexPattern}$`, $options: 'i' };
            }
        } else if (isActive !== undefined) {
            filter.isActive = isActive === 'true' || isActive === true;
        }

        if (search) {
            const matchingEmployees = await Employee.find({
                tenant: tenantId,
                $or: [
                    { employeeCode: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            const empIds = matchingEmployees.map((e) => e._id);

            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { section: { $regex: search, $options: 'i' } },
                ...(empIds.length > 0 ? [
                    { currentOperators: { $in: empIds } },
                    { currentOperator: { $in: empIds } }
                ] : [])
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [machines, total] = await Promise.all([
            Machine.find(filter)
                .populate('capacityUnit', 'name symbol type')
                .populate('defaultLocation', 'name code type')
                .populate('currentOperators', 'name employeeCode department')
                .populate('currentOperator', 'name employeeCode department')
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
            const matchingEmployees = await Employee.find({
                tenant: tenantId,
                $or: [
                    { employeeCode: { $regex: search, $options: 'i' } },
                    { name: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            const empIds = matchingEmployees.map((e) => e._id);

            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { section: { $regex: search, $options: 'i' } },
                ...(empIds.length > 0 ? [
                    { currentOperators: { $in: empIds } },
                    { currentOperator: { $in: empIds } }
                ] : [])
            ];
        }

        const machines = await Machine.find(filter)
            .populate('currentOperators', 'name employeeCode department')
            .populate('currentOperator', 'name employeeCode')
            .sort({ name: 1 });

        const fields = [
            { label: 'Machine Code', key: 'code' },
            { label: 'Machine Name', key: 'name' },
            { label: 'Section', key: (m) => m.section || '' },
            { label: 'Capacity Per Hour', key: (m) => m.capacityPerHour || '' },
            {
                label: 'Operators',
                key: (m) => {
                    const ops = (Array.isArray(m.currentOperators) && m.currentOperators.length > 0)
                        ? m.currentOperators
                        : (m.currentOperator ? [m.currentOperator] : []);
                    if (!ops.length) return '';
                    return ops.map((op) => (typeof op === 'object' && op
                        ? `${op.employeeCode ? `${op.employeeCode} - ` : ''}${op.name}`
                        : String(op))).join(', ');
                }
            },
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
            .populate('defaultLocation', 'name code type')
            .populate('currentOperators', 'name employeeCode department')
            .populate('currentOperator', 'name employeeCode department');

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
            plantLocation,
            capacityPerHour,
            capacityUnit,
            defaultLocation,
            currentOperator,
            currentOperators,
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

        if (section) machine.section = String(section).trim();
        if (plantLocation !== undefined) {
            if (plantLocation && mongoose.Types.ObjectId.isValid(plantLocation)) {
                const locDoc = await Location.findOne({ _id: plantLocation, tenant: tenantId });
                if (locDoc) {
                    machine.plantLocation = locDoc.name;
                    machine.defaultLocation = locDoc._id;
                } else {
                    machine.plantLocation = String(plantLocation).trim();
                }
            } else {
                machine.plantLocation = String(plantLocation).trim();
            }
        }
        if (capacityPerHour !== undefined) machine.capacityPerHour = Number(capacityPerHour);
        if (currentOperators !== undefined || currentOperator !== undefined) {
            const rawOpsInput = currentOperators !== undefined ? currentOperators : (currentOperator ? [currentOperator] : []);
            const rawOpsArray = Array.isArray(rawOpsInput) ? rawOpsInput : [rawOpsInput];
            const resolvedOperatorIds = [];

            for (const op of rawOpsArray) {
                if (!op) continue;
                if (mongoose.Types.ObjectId.isValid(op) && String(new mongoose.Types.ObjectId(op)) === String(op)) {
                    const emp = await Employee.findOne({ _id: op, tenant: tenantId });
                    if (emp && !resolvedOperatorIds.some((id) => String(id) === String(emp._id))) {
                        resolvedOperatorIds.push(emp._id);
                    }
                } else if (typeof op === 'string' && op.trim()) {
                    const emp = await Employee.findOne({
                        tenant: tenantId,
                        $or: [
                            { employeeCode: op.trim().toUpperCase() },
                            { name: op.trim() }
                        ]
                    });
                    if (emp && !resolvedOperatorIds.some((id) => String(id) === String(emp._id))) {
                        resolvedOperatorIds.push(emp._id);
                    }
                }
            }
            machine.currentOperators = resolvedOperatorIds;
            machine.currentOperator = resolvedOperatorIds[0] || null;
        }
        if (status) machine.status = status;
        if (isActive !== undefined) machine.isActive = isActive;

        await machine.save();

        await machine.populate([
            { path: 'capacityUnit', select: 'name symbol type' },
            { path: 'defaultLocation', select: 'name code type' },
            { path: 'currentOperators', select: 'name employeeCode department' },
            { path: 'currentOperator', select: 'name employeeCode department' }
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

/**
 * @desc    Update machine status only (partial update)
 * @route   PATCH /api/machines/:id/status
 * @access  Private (MASTER_DATA:UPDATE permission)
 */
const updateMachineStatus = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const machine = await Machine.findOne({ _id: req.params.id, tenant: tenantId });
        if (!machine) {
            return res.status(404).json({
                success: false,
                message: 'Machine not found.'
            });
        }

        const { status, isActive } = req.body;
        if (status) {
            machine.status = String(status).trim().toUpperCase();
        }
        if (isActive !== undefined) {
            machine.isActive = Boolean(isActive);
        }

        await machine.save();

        return res.status(200).json({
            success: true,
            message: 'Machine status updated successfully.',
            data: machine
        });
    } catch (error) {
        console.error('Error in updateMachineStatus:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update machine status.',
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
    updateMachineStatus,
    deleteMachine
};
