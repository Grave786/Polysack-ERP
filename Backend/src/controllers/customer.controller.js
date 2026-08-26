const Customer = require('../models/customer.model');
const { generateCsv, sendCsvResponse } = require('../utils/csvExport');

/**
 * @desc    Create a new Customer
 * @route   POST /api/customers
 * @access  Private (MASTER_DATA:CREATE permission)
 */
const createCustomer = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        // Always strip read-only fields and tenant from body
        delete req.body.outstandingAmount;
        delete req.body.tenant;

        const {
            code,
            companyName,
            contactPerson,
            phone,
            email,
            address,
            city,
            state,
            gstin,
            creditLimit,
            status,
            isActive
        } = req.body;

        // 1. Validation
        if (!code || !companyName || !companyName.trim()) {
            return res.status(400).json({
                success: false,
                message: 'Please provide required fields: code and companyName.'
            });
        }

        const formattedCode = String(code).trim().toUpperCase();
        const formattedCompanyName = String(companyName).trim();
        const formattedGstin = gstin && gstin.trim() ? gstin.trim().toUpperCase() : undefined;

        // 2. Duplicate checks per tenant
        const existingCode = await Customer.findOne({ code: formattedCode, tenant: tenantId });
        if (existingCode) {
            return res.status(400).json({
                success: false,
                message: `A customer with code '${formattedCode}' already exists in your organization.`
            });
        }

        const existingCompany = await Customer.findOne({ companyName: formattedCompanyName, tenant: tenantId });
        if (existingCompany) {
            return res.status(400).json({
                success: false,
                message: `A customer with company name '${formattedCompanyName}' already exists in your organization.`
            });
        }

        if (formattedGstin) {
            const existingGstin = await Customer.findOne({ gstin: formattedGstin, tenant: tenantId });
            if (existingGstin) {
                return res.status(400).json({
                    success: false,
                    message: `A customer with GSTIN '${formattedGstin}' already exists in your organization.`
                });
            }
        }

        // 3. Create Customer
        const customer = new Customer({
            code: formattedCode,
            companyName: formattedCompanyName,
            contactPerson,
            phone,
            email,
            address,
            city,
            state,
            gstin: formattedGstin,
            creditLimit: creditLimit !== undefined ? Number(creditLimit) : 0,
            outstandingAmount: 0, // Read-only, starts at 0
            status: status || 'LEAD',
            isActive: isActive !== undefined ? isActive : true,
            tenant: tenantId
        });

        await customer.save();

        return res.status(201).json({
            success: true,
            message: 'Customer created successfully.',
            data: customer
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in createCustomer:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create Customer.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all customers scoped to user's tenant
 * @route   GET /api/customers
 * @access  Private (MASTER_DATA:READ permission)
 */
const getCustomers = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { status, isActive, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') {
                filter.isActive = true;
            } else if (status === 'Inactive' || status === 'INACTIVE') {
                filter.isActive = false;
            } else if (status === 'Lead' || status === 'LEAD') {
                filter.$or = [
                    { status: 'LEAD' },
                    { status: 'INACTIVE_LEAD' },
                    { status: { $regex: 'lead', $options: 'i' } }
                ];
            } else {
                filter.status = status;
            }
        }

        if (search) {
            filter.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { gstin: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } },
                { contactPerson: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [customers, total] = await Promise.all([
            Customer.find(filter).sort({ companyName: 1 }).skip(skip).limit(limitNum),
            Customer.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: customers.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: customers
        });
    } catch (error) {
        console.error('Error in getCustomers:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch customers.',
            error: error.message
        });
    }
};

/**
 * @desc    Export customers to CSV respecting tenant & query filters
 * @route   GET /api/customers/export
 * @access  Private (MASTER_DATA:READ permission)
 */
const exportCustomers = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const { status, isActive, search } = req.query;
        const filter = { tenant: tenantId };

        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') {
                filter.isActive = true;
            } else if (status === 'Inactive' || status === 'INACTIVE') {
                filter.isActive = false;
            } else if (status === 'Lead' || status === 'LEAD') {
                filter.$or = [
                    { status: 'LEAD' },
                    { status: 'INACTIVE_LEAD' },
                    { status: { $regex: 'lead', $options: 'i' } }
                ];
            } else {
                filter.status = status;
            }
        }
        if (search) {
            filter.$or = [
                { companyName: { $regex: search, $options: 'i' } },
                { code: { $regex: search, $options: 'i' } },
                { gstin: { $regex: search, $options: 'i' } },
                { city: { $regex: search, $options: 'i' } },
                { contactPerson: { $regex: search, $options: 'i' } }
            ];
        }

        const customers = await Customer.find(filter).sort({ companyName: 1 });

        const fields = [
            { label: 'Customer Code', key: 'code' },
            { label: 'Company Name', key: 'companyName' },
            { label: 'Contact Person', key: (c) => c.contactPerson || '' },
            { label: 'Phone', key: (c) => c.phone || '' },
            { label: 'Email', key: (c) => c.email || '' },
            { label: 'GSTIN', key: (c) => c.gstin || '' },
            { label: 'City', key: (c) => c.city || '' },
            { label: 'State', key: (c) => c.state || '' },
            { label: 'Credit Limit (INR)', key: (c) => c.creditLimit || 0 },
            { label: 'Status', key: (c) => c.status || 'ACTIVE_CUSTOMER' },
            { label: 'Is Active', key: (c) => c.isActive !== false ? 'Active' : 'Inactive' }
        ];

        const csvContent = generateCsv(customers, fields);
        return sendCsvResponse(res, `customers_export_${Date.now()}.csv`, csvContent);
    } catch (error) {
        console.error('Error in exportCustomers:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export customers to CSV.'
        });
    }
};

/**
 * @desc    Get customer by ID scoped to user's tenant
 * @route   GET /api/customers/:id
 * @access  Private (MASTER_DATA:READ permission)
 */
const getCustomerById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const customer = await Customer.findOne({ _id: req.params.id, tenant: tenantId });

        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: customer
        });
    } catch (error) {
        console.error('Error in getCustomerById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve customer.',
            error: error.message
        });
    }
};

/**
 * @desc    Update customer scoped to user's tenant (outstandingAmount is read-only)
 * @route   PUT /api/customers/:id
 * @access  Private (MASTER_DATA:UPDATE permission)
 */
const updateCustomer = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const customer = await Customer.findOne({ _id: req.params.id, tenant: tenantId });
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found.'
            });
        }

        // Always strip read-only fields and tenant
        delete req.body.outstandingAmount;
        delete req.body.tenant;

        const {
            code,
            companyName,
            contactPerson,
            phone,
            email,
            address,
            city,
            state,
            gstin,
            creditLimit,
            status,
            isActive
        } = req.body;

        if (code) {
            const formattedCode = String(code).trim().toUpperCase();
            if (formattedCode !== customer.code) {
                const existingCode = await Customer.findOne({
                    code: formattedCode,
                    tenant: tenantId,
                    _id: { $ne: customer._id }
                });
                if (existingCode) {
                    return res.status(400).json({
                        success: false,
                        message: `A customer with code '${formattedCode}' already exists in your organization.`
                    });
                }
                customer.code = formattedCode;
            }
        }

        if (companyName && companyName.trim() !== customer.companyName) {
            const formattedCompanyName = companyName.trim();
            const existingCompany = await Customer.findOne({
                companyName: formattedCompanyName,
                tenant: tenantId,
                _id: { $ne: customer._id }
            });
            if (existingCompany) {
                return res.status(400).json({
                    success: false,
                    message: `A customer with company name '${formattedCompanyName}' already exists in your organization.`
                });
            }
            customer.companyName = formattedCompanyName;
        }

        if (gstin !== undefined) {
            const formattedGstin = gstin && gstin.trim() ? gstin.trim().toUpperCase() : undefined;
            if (formattedGstin && formattedGstin !== customer.gstin) {
                const existingGstin = await Customer.findOne({
                    gstin: formattedGstin,
                    tenant: tenantId,
                    _id: { $ne: customer._id }
                });
                if (existingGstin) {
                    return res.status(400).json({
                        success: false,
                        message: `A customer with GSTIN '${formattedGstin}' already exists in your organization.`
                    });
                }
            }
            customer.gstin = formattedGstin;
        }

        if (contactPerson !== undefined) customer.contactPerson = contactPerson;
        if (phone !== undefined) customer.phone = phone;
        if (email !== undefined) customer.email = email;
        if (address !== undefined) customer.address = address;
        if (city !== undefined) customer.city = city;
        if (state !== undefined) customer.state = state;
        if (creditLimit !== undefined) customer.creditLimit = Number(creditLimit);
        if (status) customer.status = status;
        if (isActive !== undefined) customer.isActive = isActive;

        await customer.save();

        return res.status(200).json({
            success: true,
            message: 'Customer updated successfully.',
            data: customer
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in updateCustomer:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update Customer.',
            error: error.message
        });
    }
};

/**
 * @desc    Soft delete Customer (isActive: false) scoped to user's tenant
 * @route   DELETE /api/customers/:id
 * @access  Private (MASTER_DATA:DELETE permission)
 */
const deleteCustomer = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const customer = await Customer.findOne({ _id: req.params.id, tenant: tenantId });
        if (!customer) {
            return res.status(404).json({
                success: false,
                message: 'Customer not found.'
            });
        }

        customer.isActive = false;
        await customer.save();

        return res.status(200).json({
            success: true,
            message: 'Customer deactivated successfully.',
            data: customer
        });
    } catch (error) {
        console.error('Error in deleteCustomer:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete Customer.',
            error: error.message
        });
    }
};

module.exports = {
    createCustomer,
    getCustomers,
    exportCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer
};
