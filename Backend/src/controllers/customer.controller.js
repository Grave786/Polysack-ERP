const mongoose = require('mongoose');
const Customer = require('../models/customer.model');
const OrderEnquiry = require('../models/orderEnquiry.model');
const { generateNextCustomerCode, peekNextCustomerCode } = require('../models/customer.model');
const { generateCsv, sendCsvResponse } = require('../utils/csvExport');

/**
 * Helper to process a single customer creation with atomic code generation and retry
 */
const createSingleCustomerRecord = async ({ tenantId, customerData }) => {
    // Normalize payload: trim strings, convert empty strings to undefined to avoid unique index collisions (Requirement 3)
    const trimmedCompanyName = customerData.companyName ? String(customerData.companyName).trim() : '';
    const trimmedContact = customerData.contactPerson && String(customerData.contactPerson).trim() ? String(customerData.contactPerson).trim() : undefined;
    const trimmedPhone = customerData.phone && String(customerData.phone).trim() ? String(customerData.phone).trim() : undefined;
    const trimmedEmail = customerData.email && String(customerData.email).trim() ? String(customerData.email).trim().toLowerCase() : undefined;
    const trimmedGstin = customerData.gstin && String(customerData.gstin).trim() ? String(customerData.gstin).trim().toUpperCase() : undefined;
    const trimmedPan = customerData.panNumber && String(customerData.panNumber).trim() ? String(customerData.panNumber).trim().toUpperCase() : undefined;
    const trimmedCity = customerData.city && String(customerData.city).trim() ? String(customerData.city).trim() : undefined;
    const trimmedState = customerData.state && String(customerData.state).trim() ? String(customerData.state).trim() : undefined;
    const trimmedAddress = customerData.address && String(customerData.address).trim() ? String(customerData.address).trim() : undefined;
    const trimmedPaymentTerms = customerData.paymentTerms && String(customerData.paymentTerms).trim() ? String(customerData.paymentTerms).trim() : undefined;
    const trimmedSourceLeadId = customerData.sourceLeadId && String(customerData.sourceLeadId).trim() ? String(customerData.sourceLeadId).trim() : undefined;

    // 0. If sourceLeadId provided, verify NSL is Approved and not already Confirmed (Requirement 4 & 6)
    if (trimmedSourceLeadId) {
        const isObjectId = mongoose.Types.ObjectId.isValid(trimmedSourceLeadId);
        const linkedEnquiry = await OrderEnquiry.findOne({
            tenant: new mongoose.Types.ObjectId(tenantId),
            $or: [
                ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(trimmedSourceLeadId) }] : []),
                { nslNumber: trimmedSourceLeadId }
            ]
        });
        if (linkedEnquiry) {
            const isConfirmed = linkedEnquiry.status === 'Confirmed' || linkedEnquiry.orderConfirmed;
            if (isConfirmed) {
                const err = new Error('Sales Order already generated for this enquiry');
                err.statusCode = 409;
                throw err;
            }

            const isLegacy = !linkedEnquiry.soApprovalStatus && !['Pending Approval', 'Rejected', 'Approved'].includes(linkedEnquiry.status);
            const isApproved = isLegacy ||
                               linkedEnquiry.status === 'Approved' ||
                               linkedEnquiry.soApprovalStatus === 'Approved';
            if (!isApproved) {
                const isRejected = linkedEnquiry.status === 'Rejected' || linkedEnquiry.soApprovalStatus === 'Rejected';
                const err = new Error(
                    isRejected
                        ? `Cannot create customer: NSL '${linkedEnquiry.nslNumber || trimmedSourceLeadId}' was rejected.`
                        : 'NSL is waiting for Tenant Admin approval'
                );
                err.statusCode = 400;
                throw err;
            }
        }
    }

    // 1. Check if customer already exists by GSTIN (if non-empty)
    if (trimmedGstin) {
        const existingGstin = await Customer.findOne({
            gstin: trimmedGstin,
            tenant: new mongoose.Types.ObjectId(tenantId)
        });
        if (existingGstin) {
            return { customer: existingGstin, isExisting: true };
        }
    }

    // 2. Check if customer already exists by companyName (case-insensitive)
    const escapedCompanyName = trimmedCompanyName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const existingCompany = await Customer.findOne({
        companyName: { $regex: new RegExp(`^${escapedCompanyName}$`, 'i') },
        tenant: new mongoose.Types.ObjectId(tenantId)
    });
    if (existingCompany) {
        return { customer: existingCompany, isExisting: true };
    }

    // 3. Atomically generate sequential customer code and save with retry on code collision (Requirement 2)
    let customer = null;
    let attempts = 0;
    const maxAttempts = 4; // Initial attempt + up to 3 retries

    while (attempts < maxAttempts) {
        attempts++;
        const customerCode = await generateNextCustomerCode(tenantId);

        customer = new Customer({
            code: customerCode,
            companyName: trimmedCompanyName,
            contactPerson: trimmedContact,
            phone: trimmedPhone,
            email: trimmedEmail,
            address: trimmedAddress,
            city: trimmedCity,
            state: trimmedState,
            gstin: trimmedGstin,
            panNumber: trimmedPan,
            paymentTerms: trimmedPaymentTerms,
            creditLimit: customerData.creditLimit !== undefined ? Number(customerData.creditLimit) : 0,
            outstandingAmount: 0,
            sourceLeadId: trimmedSourceLeadId,
            status: customerData.status || 'LEAD',
            isActive: customerData.isActive !== undefined ? customerData.isActive : true,
            tenant: new mongoose.Types.ObjectId(tenantId)
        });

        try {
            await customer.save();
            break; // Successfully saved
        } catch (saveErr) {
            const isCodeDuplicate = saveErr.code === 11000 && (
                (saveErr.keyPattern && saveErr.keyPattern.code) ||
                (saveErr.message && saveErr.message.includes('code_'))
            );
            if (isCodeDuplicate && attempts < maxAttempts) {
                console.warn(`[createCustomer] Code ${customerCode} collided (attempt ${attempts}/${maxAttempts}), retrying with next code...`);
                continue;
            }
            throw saveErr;
        }
    }

    // 4. Link lead with new customer if sourceLeadId provided (Requirement 6)
    if (trimmedSourceLeadId && customer?._id) {
        try {
            const isObjectId = mongoose.Types.ObjectId.isValid(trimmedSourceLeadId);
            await OrderEnquiry.updateOne(
                {
                    tenant: new mongoose.Types.ObjectId(tenantId),
                    $or: [
                        ...(isObjectId ? [{ _id: new mongoose.Types.ObjectId(trimmedSourceLeadId) }] : []),
                        { nslNumber: trimmedSourceLeadId }
                    ]
                },
                {
                    $set: {
                        customer: customer._id,
                        customerRef: customer._id,
                        customerType: 'Existing'
                    }
                }
            );
        } catch (linkErr) {
            console.error('Failed to link enquiry with customer:', linkErr);
        }
    }

    return { customer, isExisting: false };
};

/**
 * @desc    Create a new Customer (or bulk import)
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

        // Handle bulk import / creation if payload is an array or contains customers array
        const rawItems = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.customers) ? req.body.customers : null);
        if (rawItems && rawItems.length > 0) {
            const createdResults = [];
            for (const item of rawItems) {
                if (!item.companyName || !String(item.companyName).trim()) continue;
                delete item.outstandingAmount;
                delete item.tenant;
                const result = await createSingleCustomerRecord({ tenantId, customerData: item });
                createdResults.push(result.customer);
            }
            return res.status(201).json({
                success: true,
                message: `Successfully processed ${createdResults.length} customers.`,
                data: createdResults
            });
        }

        // Single Customer Creation
        delete req.body.outstandingAmount;
        delete req.body.tenant;

        const { companyName } = req.body;
        if (!companyName || !String(companyName).trim()) {
            return res.status(400).json({
                success: false,
                message: 'Company name is required.'
            });
        }

        const { customer, isExisting } = await createSingleCustomerRecord({
            tenantId,
            customerData: req.body
        });

        if (isExisting) {
            return res.status(200).json({
                success: true,
                data: customer,
                message: 'Existing customer used'
            });
        }

        return res.status(201).json({
            success: true,
            message: 'Customer created successfully.',
            data: customer
        });
    } catch (error) {
        if (error.statusCode || error.status) {
            return res.status(error.statusCode || error.status).json({
                success: false,
                message: error.message
            });
        }
        if (error.code === 11000) {
            const keyPattern = error.keyPattern || {};
            const isGstinDup = keyPattern.gstin || (error.message && error.message.includes('gstin_'));
            if (isGstinDup) {
                return res.status(400).json({
                    success: false,
                    message: 'A customer with this GSTIN already exists for your organization.'
                });
            }
            const isCompanyDup = keyPattern.companyName || (error.message && error.message.includes('companyName_'));
            if (isCompanyDup) {
                return res.status(400).json({
                    success: false,
                    message: `A customer with company name '${req.body?.companyName || ''}' already exists.`
                });
            }
            const isCodeDup = keyPattern.code || (error.message && error.message.includes('code_'));
            if (isCodeDup) {
                return res.status(400).json({
                    success: false,
                    message: 'Customer code collision occurred after multiple retries. Please try again.'
                });
            }
            return res.status(400).json({
                success: false,
                message: 'A duplicate record already exists with these unique details.'
            });
        }
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in createCustomer:', error.stack || error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Failed to create Customer.',
            error: error.message,
            stack: error.stack
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

        const { status, isActive, showInactive, search, page = 1, limit = 10 } = req.query;

        const filter = { tenant: tenantId };

        if (showInactive === 'true') {
            // Admin table with 'Show Inactive' toggle ON — return all records, no status filter
        } else {
            // --- Active / Inactive filter ---
            // If caller explicitly passes isActive=false or status=Inactive/INACTIVE,
            // show inactive records. Otherwise, always exclude soft-deleted and inactive.
            const wantsInactive =
                isActive === 'false' ||
                status === 'Inactive' ||
                status === 'INACTIVE' ||
                status === 'inactive';

            const wantsAll = status === 'All' || status === 'ALL';

            if (!wantsAll && !wantsInactive) {
                // Default: only return records that are both isActive:true AND not INACTIVE status
                filter.isActive = true;
                filter.status = { $ne: 'INACTIVE' };
            } else if (wantsInactive) {
                // Caller wants inactive records specifically
                filter.$or = [
                    { isActive: false },
                    { status: 'INACTIVE' }
                ];
            }
            // wantsAll → no extra filter, return everything

            // Status-specific sub-filters (applied on top when not wantsAll/wantsInactive)
            if (!wantsAll && !wantsInactive && status && status !== 'All' && status !== 'ALL') {
                if (status === 'Active' || status === 'ACTIVE') {
                    // Already handled above (isActive:true, status≠INACTIVE)
                } else if (status === 'ACTIVE_CUSTOMER') {
                    filter.status = 'ACTIVE_CUSTOMER';
                } else if (status === 'Lead' || status === 'LEAD') {
                    filter.status = 'LEAD';
                    delete filter.isActive; // leads can still be active
                } else {
                    filter.status = status;
                }
            }
        }

        if (search) {
            filter.$and = filter.$and || [];
            filter.$and.push({
                $or: [
                    { companyName: { $regex: search, $options: 'i' } },
                    { code: { $regex: search, $options: 'i' } },
                    { gstin: { $regex: search, $options: 'i' } },
                    { city: { $regex: search, $options: 'i' } },
                    { contactPerson: { $regex: search, $options: 'i' } }
                ]
            });
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 10);
        const skip = (pageNum - 1) * limitNum;

        const [customers, total] = await Promise.all([
            Customer.find(filter).sort({ code: 1 }).skip(skip).limit(limitNum),
            Customer.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: customers.length,
            totalCount: total,
            pagination: {
                total,
                totalCount: total,
                page: pageNum,
                currentPage: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1,
                totalPages: Math.ceil(total / limitNum) || 1
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

        const customers = await Customer.find(filter).sort({ code: 1 });

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
            panNumber,
            paymentTerms,
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
        if (panNumber !== undefined) customer.panNumber = panNumber ? String(panNumber).trim().toUpperCase() : '';
        if (paymentTerms !== undefined) customer.paymentTerms = paymentTerms ? String(paymentTerms).trim() : '';
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

/**
 * @desc    Get next sequential customer code for current tenant (preview)
 * @route   GET /api/customers/next-code
 * @access  Private (MASTER_DATA:READ permission)
 */
const getNextCustomerCodeHandler = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid.'
            });
        }
        const nextCode = await peekNextCustomerCode(tenantId);
        return res.status(200).json({
            success: true,
            data: { nextCode }
        });
    } catch (error) {
        console.error('Error in getNextCustomerCodeHandler:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve next customer code.',
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
    deleteCustomer,
    getNextCustomerCodeHandler,
    generateNextCustomerCode,
    peekNextCustomerCode
};

