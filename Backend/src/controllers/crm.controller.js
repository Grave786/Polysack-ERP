const mongoose = require('mongoose');
const CustomerInteraction = require('../models/customerInteraction.model');
const Complaint = require('../models/complaint.model');
const OrderEnquiry = require('../models/orderEnquiry.model');
const Enquiry = OrderEnquiry;
const Customer = require('../models/customer.model');
const User = require('../models/user.model');
const SalesOrder = require('../models/salesOrder.model');
const Invoice = require('../models/invoice.model');
const { normalizeEnum } = require('../utils/enumNormalizer');

/**
 * Auto-generates sequential complaint ticket number per tenant (COMP-YYYY-0001...)
 */
const generateComplaintTicketNumber = async (tenantId) => {
    const year = new Date().getFullYear();
    const prefix = `COMP-${year}-`;

    const lastDoc = await Complaint.findOne({
        tenant: tenantId,
        ticketNumber: { $regex: `^${prefix}\\d{4,}$` }
    }).sort({ ticketNumber: -1 });

    let nextNumber = 1;
    if (lastDoc && lastDoc.ticketNumber) {
        const parts = lastDoc.ticketNumber.split('-');
        const lastSeq = parseInt(parts[2], 10);
        if (!isNaN(lastSeq)) {
            nextNumber = lastSeq + 1;
        }
    }

    const paddedSeq = String(nextNumber).padStart(4, '0');
    return `${prefix}${paddedSeq}`;
};

// ==========================================
// 1. CUSTOMER INTERACTIONS CONTROLLERS
// ==========================================

/**
 * @desc    Create a Customer Interaction / Follow-up Log
 * @route   POST /api/crm/interactions
 * @access  Private (SALES:CREATE permission)
 */
const createInteraction = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        delete req.body.tenant;

        const {
            customer,
            customerId,
            date,
            interactionType,
            subject,
            notes,
            assignedExecutive,
            status,
            nextFollowUpDate,
            enquiryId,
            referenceId,
            customerName
        } = req.body;

        const targetCustomer = customer || customerId;
        const refId = enquiryId || referenceId;

        if (!targetCustomer && !refId && !customerName) {
            return res.status(400).json({
                success: false,
                message: 'Please provide customer ObjectId, customerName, or enquiry reference.'
            });
        }

        let resolvedCustomer = null;
        if (targetCustomer && mongoose.Types.ObjectId.isValid(targetCustomer)) {
            const customerDoc = await Customer.findOne({ _id: targetCustomer, ...(tenantId && { tenant: tenantId }) });
            if (customerDoc) resolvedCustomer = customerDoc._id;
        }

        let resolvedName = customerName || undefined;
        if (!resolvedCustomer && refId && mongoose.Types.ObjectId.isValid(refId)) {
            const enq = await OrderEnquiry.findById(refId);
            if (enq) {
                resolvedCustomer = enq.customerRef || enq.customer || null;
                if (!resolvedCustomer) {
                    resolvedName = enq.newCustomerDetails?.company || enq.newCustomerDetails?.name;
                }
            }
        }

        if (assignedExecutive) {
            const execDoc = await User.findOne({ _id: assignedExecutive, ...(tenantId && { tenant: tenantId }), isActive: true });
            if (!execDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Assigned Executive user not found.'
                });
            }
        }

        const interaction = new CustomerInteraction({
            tenant: tenantId,
            customer: resolvedCustomer,
            customerName: resolvedName,
            enquiryId: refId || null,
            referenceId: refId || null,
            date: date ? new Date(date) : new Date(),
            interactionType: interactionType || 'Phone Call',
            subject: (subject || `Follow-up: ${refId || 'Lead'}`).trim(),
            notes: notes ? notes.trim() : undefined,
            assignedExecutive: assignedExecutive || req.user._id || req.user.id,
            status: status || 'OPEN',
            nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
            isActive: true
        });

        await interaction.save();

        await interaction.populate([
            { path: 'customer', select: 'companyName code contactPerson phone email' },
            { path: 'assignedExecutive', select: 'name email role' }
        ]);

        return res.status(201).json({
            success: true,
            message: 'Customer interaction logged successfully.',
            data: interaction
        });
    } catch (error) {
        console.error('Error in createInteraction:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to log customer interaction.'
        });
    }
};

/**
 * @desc    Get Customer Interactions with filtering and pagination
 * @route   GET /api/crm/interactions
 * @access  Private (SALES:READ permission)
 */
const getInteractions = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { customer, status, interactionType, assignedExecutive, startDate, endDate, search, page = 1, limit = 20 } = req.query;
        const filter = { isActive: { $ne: false } };
        if (tenantId) filter.tenant = tenantId;

        if (customer) filter.customer = customer;
        if (status && status !== 'All' && status !== 'ALL' && status !== 'All Statuses' && status !== 'undefined') {
            if (status.includes('Open') || status === 'OPEN') {
                filter.status = 'OPEN';
            } else if (status.includes('Closed') || status.includes('Resolved') || status === 'CLOSED') {
                filter.status = 'CLOSED';
            } else if (status.includes('Pending') || status.includes('Progress') || status === 'IN_PROGRESS') {
                filter.status = 'IN_PROGRESS';
            } else {
                filter.status = status;
            }
        }
        if (interactionType && interactionType !== 'All' && interactionType !== 'All Types' && interactionType !== 'undefined') {
            filter.interactionType = interactionType;
        }
        if (assignedExecutive) filter.assignedExecutive = assignedExecutive;

        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.date.$lte = end;
            }
        }

        if (search) {
            filter.$or = [
                { subject: { $regex: search, $options: 'i' } },
                { notes: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [interactions, total] = await Promise.all([
            CustomerInteraction.find(filter)
                .populate('customer', 'companyName code contactPerson phone email')
                .populate('assignedExecutive', 'name email role')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum),
            CustomerInteraction.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: interactions.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: interactions
        });
    } catch (error) {
        console.error('Error in getInteractions:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch customer interactions.',
            error: error.message
        });
    }
};

/**
 * @desc    Export Customer Interactions to CSV
 * @route   GET /api/crm/interactions/export-csv
 * @access  Private (SALES:READ permission)
 */
const exportInteractionsCsv = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { customer, status, interactionType, assignedExecutive } = req.query;
        const filter = { tenant: tenantId, isActive: true };

        if (customer) filter.customer = customer;
        if (status) filter.status = status;
        if (interactionType) filter.interactionType = interactionType;
        if (assignedExecutive) filter.assignedExecutive = assignedExecutive;

        const list = await CustomerInteraction.find(filter)
            .populate('customer', 'companyName code')
            .populate('assignedExecutive', 'name')
            .sort({ date: -1 });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="customer-interactions.csv"');

        let csv = 'Date,Customer Code,Customer Name,Type,Subject,Assigned Executive,Status,Next Follow Up\n';
        for (const item of list) {
            const dateStr = item.date ? item.date.toISOString().split('T')[0] : '';
            const custCode = `"${item.customer ? item.customer.code : ''}"`;
            const custName = `"${item.customer ? item.customer.companyName : ''}"`;
            const type = `"${item.interactionType || ''}"`;
            const subj = `"${(item.subject || '').replace(/"/g, '""')}"`;
            const exec = `"${item.assignedExecutive ? item.assignedExecutive.name : ''}"`;
            const st = `"${item.status || ''}"`;
            const nextDate = item.nextFollowUpDate ? item.nextFollowUpDate.toISOString().split('T')[0] : '';

            csv += `${dateStr},${custCode},${custName},${type},${subj},${exec},${st},${nextDate}\n`;
        }

        return res.status(200).send(csv);
    } catch (error) {
        console.error('Error in exportInteractionsCsv:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export customer interactions CSV.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Customer Interaction by ID
 * @route   GET /api/crm/interactions/:id
 * @access  Private (SALES:READ permission)
 */
const getInteractionById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const interaction = await CustomerInteraction.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('customer', 'companyName code contactPerson phone email address city state')
            .populate('assignedExecutive', 'name email role');

        if (!interaction) {
            return res.status(404).json({
                success: false,
                message: 'Interaction not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: interaction
        });
    } catch (error) {
        console.error('Error in getInteractionById:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve interaction.',
            error: error.message
        });
    }
};

/**
 * @desc    Update Customer Interaction
 * @route   PUT /api/crm/interactions/:id
 * @access  Private (SALES:UPDATE permission)
 */
const updateInteraction = async (req, res) => {
    try {
        delete req.body.tenant;


        const interaction = await CustomerInteraction.findByIdAndUpdate(
            req.params.id,
            { $set: req.body },
            { new: true, runValidators: true }
        )
        .populate('customer', 'companyName code contactPerson phone email')
        .populate('assignedExecutive', 'name email role');

        if (!interaction) {
            return res.status(404).json({
                success: false,
                message: 'Interaction not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Customer interaction updated successfully.',
            data: interaction
        });
    } catch (error) {
        console.error('Error in updateInteraction:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update interaction.'
        });
    }
};

/**
 * @desc    Delete Customer Interaction
 * @route   DELETE /api/crm/interactions/:id
 * @access  Private (SALES:DELETE permission)
 */
const deleteInteraction = async (req, res) => {
    try {
        const interaction = await CustomerInteraction.findByIdAndDelete(req.params.id);
        if (!interaction) {
            return res.status(404).json({
                success: false,
                message: 'Interaction not found.'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Customer interaction deleted successfully.'
        });
    } catch (error) {
        console.error('Error in deleteInteraction:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to delete interaction.',
            error: error.message
        });
    }
};

// ==========================================
// 2. CUSTOMER COMPLAINTS CONTROLLERS
// ==========================================

/**
 * @desc    Log a Quality & Delivery Complaint
 * @route   POST /api/crm/complaints
 * @access  Private (SALES:CREATE permission)
 */
const createComplaint = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        delete req.body.tenant;
        delete req.body.ticketNumber;

        const {
            customer,
            relatedSalesOrder,
            relatedInvoice,
            date,
            complaintType,
            description,
            assignedExecutive,
            status,
            resolutionNotes
        } = req.body;

        if (!customer || !complaintType || !description) {
            return res.status(400).json({
                success: false,
                message: 'Please provide customer ObjectId, complaintType, and description.'
            });
        }

        const customerDoc = await Customer.findOne({ _id: customer, tenant: tenantId, isActive: true });
        if (!customerDoc) {
            return res.status(400).json({
                success: false,
                message: 'Customer not found or is inactive.'
            });
        }

        if (relatedSalesOrder) {
            const soDoc = await SalesOrder.findOne({ _id: relatedSalesOrder, tenant: tenantId, isActive: true });
            if (!soDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Related Sales Order not found.'
                });
            }
        }

        if (relatedInvoice) {
            const invDoc = await Invoice.findOne({ _id: relatedInvoice, tenant: tenantId, isActive: true });
            if (!invDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Related Invoice not found.'
                });
            }
        }

        if (assignedExecutive) {
            const execDoc = await User.findOne({ _id: assignedExecutive, tenant: tenantId, isActive: true });
            if (!execDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Assigned Executive user not found.'
                });
            }
        }

        const ticketNumber = await generateComplaintTicketNumber(tenantId);

        const complaint = new Complaint({
            tenant: tenantId,
            ticketNumber,
            customer,
            relatedSalesOrder: relatedSalesOrder || null,
            relatedInvoice: relatedInvoice || null,
            date: date ? new Date(date) : new Date(),
            complaintType: normalizeEnum(complaintType, 'QUALITY_DEFECT'),
            description: description.trim(),
            assignedExecutive: assignedExecutive || req.user._id || req.user.id,
            status: status || 'Open Ticket',
            resolutionNotes: resolutionNotes ? resolutionNotes.trim() : undefined,
            resolvedAt: (status === 'Resolved / CAPA Issued' || status === 'RESOLVED') ? new Date() : null,
            isActive: true
        });

        await complaint.save();

        await complaint.populate([
            { path: 'customer', select: 'companyName code contactPerson phone email' },
            { path: 'relatedSalesOrder', select: 'soNumber orderDate status' },
            { path: 'relatedInvoice', select: 'invoiceNumber invoiceDate grandTotal' },
            { path: 'assignedExecutive', select: 'name email role' }
        ]);

        return res.status(201).json({
            success: true,
            message: `Complaint ticket '${ticketNumber}' created successfully.`,
            data: complaint
        });
    } catch (error) {
        console.error('Error in createComplaint:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to create complaint.'
        });
    }
};

/**
 * @desc    Get Complaints with filtering and pagination
 * @route   GET /api/crm/complaints
 * @access  Private (SALES:READ permission)
 */
const getComplaints = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { customer, status, complaintType, assignedExecutive, startDate, endDate, search, page = 1, limit = 20 } = req.query;
        const filter = { tenant: tenantId, isActive: true };

        if (customer) filter.customer = customer;
        if (status && !['All', 'ALL', 'All Statuses', 'undefined', 'Active'].includes(status)) {
            filter.status = status;
        }
        if (complaintType) filter.complaintType = complaintType;
        if (assignedExecutive) filter.assignedExecutive = assignedExecutive;

        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.date.$lte = end;
            }
        }

        if (search) {
            filter.$or = [
                { ticketNumber: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { resolutionNotes: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [complaints, total] = await Promise.all([
            Complaint.find(filter)
                .populate('customer', 'companyName code contactPerson phone email')
                .populate('relatedSalesOrder', 'soNumber orderDate status')
                .populate('relatedInvoice', 'invoiceNumber invoiceDate grandTotal')
                .populate('assignedExecutive', 'name email role')
                .sort({ date: -1 })
                .skip(skip)
                .limit(limitNum),
            Complaint.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: complaints.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: complaints
        });
    } catch (error) {
        console.error('Error in getComplaints:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch complaints.',
            error: error.message
        });
    }
};

/**
 * @desc    Export Complaints to CSV
 * @route   GET /api/crm/complaints/export-csv
 * @access  Private (SALES:READ permission)
 */
const exportComplaintsCsv = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { customer, status, complaintType, assignedExecutive } = req.query;
        const filter = { tenant: tenantId, isActive: true };

        if (customer) filter.customer = customer;
        if (status && !['All', 'ALL', 'All Statuses', 'undefined', 'Active'].includes(status)) {
            filter.status = status;
        }
        if (complaintType) filter.complaintType = complaintType;
        if (assignedExecutive) filter.assignedExecutive = assignedExecutive;

        const list = await Complaint.find(filter)
            .populate('customer', 'companyName code')
            .populate('relatedSalesOrder', 'soNumber')
            .populate('relatedInvoice', 'invoiceNumber')
            .populate('assignedExecutive', 'name')
            .sort({ date: -1 });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="customer-complaints.csv"');

        let csv = 'Ticket No,Date,Customer Code,Customer Name,Type,Sales Order,Invoice,Assigned Executive,Status\n';
        for (const item of list) {
            const ticket = `"${item.ticketNumber || ''}"`;
            const dateStr = item.date ? item.date.toISOString().split('T')[0] : '';
            const custCode = `"${item.customer ? item.customer.code : ''}"`;
            const custName = `"${item.customer ? item.customer.companyName : ''}"`;
            const type = `"${item.complaintType || ''}"`;
            const so = `"${item.relatedSalesOrder ? item.relatedSalesOrder.soNumber : ''}"`;
            const inv = `"${item.relatedInvoice ? item.relatedInvoice.invoiceNumber : ''}"`;
            const exec = `"${item.assignedExecutive ? item.assignedExecutive.name : ''}"`;
            const st = `"${item.status || ''}"`;

            csv += `${ticket},${dateStr},${custCode},${custName},${type},${so},${inv},${exec},${st}\n`;
        }

        return res.status(200).send(csv);
    } catch (error) {
        console.error('Error in exportComplaintsCsv:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export complaints CSV.',
            error: error.message
        });
    }
};

/**
 * @desc    Get Complaint by ID
 * @route   GET /api/crm/complaints/:id
 * @access  Private (SALES:READ permission)
 */
const getComplaintById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const complaint = await Complaint.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('customer', 'companyName code contactPerson phone email address city state')
            .populate('relatedSalesOrder', 'soNumber orderDate status items grandTotal')
            .populate('relatedInvoice', 'invoiceNumber invoiceDate grandTotal paymentStatus')
            .populate('assignedExecutive', 'name email role');

        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found.'
            });
        }

        return res.status(200).json({
            success: true,
            data: complaint
        });
    } catch (error) {
        console.error('Error in getComplaintById:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve complaint.',
            error: error.message
        });
    }
};

/**
 * @desc    Update Complaint details and status
 * @route   PUT /api/crm/complaints/:id
 * @access  Private (SALES:UPDATE permission)
 */
const updateComplaint = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        delete req.body.tenant;
        delete req.body.ticketNumber;

        const complaint = await Complaint.findOne({ _id: req.params.id, tenant: tenantId });
        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found.'
            });
        }

        const {
            relatedSalesOrder,
            relatedInvoice,
            complaintType,
            description,
            assignedExecutive,
            status,
            resolutionNotes
        } = req.body;

        if (complaintType) complaint.complaintType = complaintType;
        if (description) complaint.description = description.trim();
        if (resolutionNotes !== undefined) complaint.resolutionNotes = resolutionNotes ? resolutionNotes.trim() : '';

        if (relatedSalesOrder !== undefined) complaint.relatedSalesOrder = relatedSalesOrder || null;
        if (relatedInvoice !== undefined) complaint.relatedInvoice = relatedInvoice || null;

        if (assignedExecutive) {
            const execDoc = await User.findOne({ _id: assignedExecutive, tenant: tenantId, isActive: true });
            if (!execDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Assigned Executive user not found.'
                });
            }
            complaint.assignedExecutive = assignedExecutive;
        }

        if (status) {
            complaint.status = status;
            if ((status === 'Resolved / CAPA Issued' || status === 'RESOLVED') && !complaint.resolvedAt) {
                complaint.resolvedAt = new Date();
            }
        }

        await complaint.save();

        await complaint.populate([
            { path: 'customer', select: 'companyName code contactPerson phone email' },
            { path: 'relatedSalesOrder', select: 'soNumber orderDate status' },
            { path: 'relatedInvoice', select: 'invoiceNumber invoiceDate grandTotal' },
            { path: 'assignedExecutive', select: 'name email role' }
        ]);

        return res.status(200).json({
            success: true,
            message: `Complaint ticket '${complaint.ticketNumber}' updated successfully.`,
            data: complaint
        });
    } catch (error) {
        console.error('Error in updateComplaint:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(400).json({
            success: false,
            message: error.message || 'Failed to update complaint.'
        });
    }
};

/**
 * @desc    Soft Delete Complaint
 * @route   DELETE /api/crm/complaints/:id
 * @access  Private (SALES:DELETE permission)
 */
const deleteComplaint = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const complaint = await Complaint.findOne({ _id: req.params.id, tenant: tenantId });
        if (!complaint) {
            return res.status(404).json({
                success: false,
                message: 'Complaint not found.'
            });
        }

        complaint.isActive = false;
        await complaint.save();

        return res.status(200).json({
            success: true,
            message: `Complaint ticket '${complaint.ticketNumber}' deleted successfully.`
        });
    } catch (error) {
        console.error('Error in deleteComplaint:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: `Invalid ID format provided for field '${error.path}'.`
            });
        }
        return res.status(500).json({
            success: false,
            message: 'Failed to delete complaint.',
            error: error.message
        });
    }
};

// ==========================================
// 3. ORDER ENQUIRIES CONTROLLERS
// ==========================================

/**
 * @desc    Create a new Order Enquiry
 * @route   POST /api/crm/enquiries
 * @access  Private (SALES:CREATE)
 */
const createOrderEnquiry = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing or invalid.' });
        }
        delete req.body.tenant;

        const { customer, customerRef, customerType, orderConfirmed, expectedDeliveryDate, poAttachments } = req.body;
        const targetCustomer = customerRef || customer;

        if (customerType !== 'New') {
            if (!targetCustomer) {
                return res.status(400).json({ success: false, message: 'Customer reference is required for existing customers.' });
            }

            const customerDoc = await Customer.findOne({ _id: targetCustomer, tenant: tenantId, isActive: true });
            if (!customerDoc) {
                return res.status(400).json({ success: false, message: 'Customer not found or is inactive.' });
            }
        }

        // Validate expected delivery date only when order is confirmed
        if (orderConfirmed && expectedDeliveryDate) {
            const deliveryDate = new Date(expectedDeliveryDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (deliveryDate < today) {
                return res.status(400).json({ success: false, message: 'Expected delivery date must be today or later.' });
            }
        }

        // Enforce max 5 attachments
        if (Array.isArray(poAttachments) && poAttachments.length > 5) {
            return res.status(400).json({ success: false, message: 'A maximum of 5 PO attachments are allowed.' });
        }

        const currentYear = new Date().getFullYear();
        // Sort by nslNumber descending to get the highest sequence, regardless of creation date
        const lastEnquiry = await OrderEnquiry.findOne({ 
            nslNumber: { $regex: `^NSL-${currentYear}-` } 
        }).sort({ nslNumber: -1 });
        
        let nextSeq = 1;
        if (lastEnquiry && lastEnquiry.nslNumber) {
            const parts = lastEnquiry.nslNumber.split('-');
            if (parts.length === 3) {
                const lastSeq = parseInt(parts[2], 10);
                if (!isNaN(lastSeq)) nextSeq = lastSeq + 1;
            }
        }
        req.body.nslNumber = `NSL-${currentYear}-${nextSeq.toString().padStart(4, '0')}`;

        const enquiry = new OrderEnquiry({
            tenant: tenantId,
            ...req.body,
            nslNumber: req.body.nslNumber,
            customer: targetCustomer || undefined,
            customerRef: targetCustomer || undefined,
            enquiryDate: req.body.enquiryDate ? new Date(req.body.enquiryDate) : new Date(),
            expectedDeliveryDate: (orderConfirmed && expectedDeliveryDate) ? new Date(expectedDeliveryDate) : null
        });

        await enquiry.save();
        if (enquiry.customer) {
            await enquiry.populate('customer', 'companyName code contactPerson phone email');
        }

        return res.status(201).json({ success: true, message: 'Order enquiry logged successfully.', data: enquiry });
    } catch (error) {
        console.error('Error in createOrderEnquiry:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: `Invalid ID format for field '${error.path}'.` });
        }
        return res.status(400).json({ success: false, message: error.message || 'Failed to create order enquiry.' });
    }
};

/**
 * @desc    Get Order Enquiries with pagination and filtering
 * @route   GET /api/crm/enquiries
 * @access  Private (SALES:READ)
 */
const getOrderEnquiries = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing or invalid.' });
        }

        const { customer, orderConfirmed, productCategory, search, page = 1, limit = 20 } = req.query;
        const filter = { tenant: tenantId, isActive: true };

        if (customer) filter.customer = customer;
        if (productCategory) filter.productCategory = productCategory;
        if (orderConfirmed !== undefined) filter.orderConfirmed = orderConfirmed === 'true';

        if (search) {
            filter.$or = [
                { contactPerson: { $regex: search, $options: 'i' } },
                { materialQualityFabric: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { remarks: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [enquiries, total] = await Promise.all([
            OrderEnquiry.find(filter)
                .populate('customer', 'companyName code contactPerson phone email')
                .populate('customerRef', 'companyName code contactPerson phone email')
                .sort({ enquiryDate: -1 })
                .skip(skip)
                .limit(limitNum),
            OrderEnquiry.countDocuments(filter)
        ]);

        return res.status(200).json({
            success: true,
            count: enquiries.length,
            pagination: { total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) || 1 },
            data: enquiries
        });
    } catch (error) {
        console.error('Error in getOrderEnquiries:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch order enquiries.', error: error.message });
    }
};

/**
 * @desc    Get a single Order Enquiry by ID
 * @route   GET /api/crm/enquiries/:id
 * @access  Private (SALES:READ)
 */
const getOrderEnquiryById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing or invalid.' });
        }

        const enquiry = await OrderEnquiry.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('customer', 'companyName code contactPerson phone email')
            .populate('customerRef', 'companyName code contactPerson phone email');

        if (!enquiry) {
            return res.status(404).json({ success: false, message: 'Order enquiry not found.' });
        }

        return res.status(200).json({ success: true, data: enquiry });
    } catch (error) {
        console.error('Error in getOrderEnquiryById:', error);
        return res.status(500).json({ success: false, message: 'Failed to fetch order enquiry.' });
    }
};

/**
 * @desc    Update an Order Enquiry
 * @route   PUT /api/crm/enquiries/:id
 * @access  Private (SALES:UPDATE)
 */
const updateOrderEnquiry = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing or invalid.' });
        }
        delete req.body.tenant;

        const enquiry = await OrderEnquiry.findOne({ _id: req.params.id, tenant: tenantId });
        if (!enquiry) {
            return res.status(404).json({ success: false, message: 'Order enquiry not found.' });
        }

        // Validate delivery date if confirmed
        const isConfirmed = req.body.orderConfirmed !== undefined ? req.body.orderConfirmed : enquiry.orderConfirmed;
        const deliveryDateRaw = req.body.expectedDeliveryDate !== undefined ? req.body.expectedDeliveryDate : enquiry.expectedDeliveryDate;
        if (isConfirmed && deliveryDateRaw) {
            const deliveryDate = new Date(deliveryDateRaw);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (deliveryDate < today) {
                return res.status(400).json({ success: false, message: 'Expected delivery date must be today or later.' });
            }
        }

        // Enforce max 5 attachments
        if (Array.isArray(req.body.poAttachments) && req.body.poAttachments.length > 5) {
            return res.status(400).json({ success: false, message: 'A maximum of 5 PO attachments are allowed.' });
        }

        const allowedFields = [
            'nslNumber', 'customerType', 'customerRef', 'newCustomerDetails', 'status', 'followUps',
            'customer', 'enquiryDate', 'contactPerson', 'contactNumber', 'contactDesignation',
            'productCategory', 'printSpec', 'printSides', 'frontColours', 'backColours',
            'jobDescriptionPrintColours', 'jobDescriptionPrintSide',
            'jobDescriptionPrintSideOther', 'materialQualityFabric', 'fabricLaminationType',
            'materialColour', 'printingColour', 'fabricGrammage', 'bagWeightGms',
            'fabricAverage', 'fabricWidthInch', 'fabricLengthInch', 'totalOrderQuantity', 'orderQuantity', 'quantityUnit',
            'orderConfirmed', 'expectedDeliveryDate', 'poAttachments', 'description', 'remarks'
        ];
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                enquiry[field] = field === 'enquiryDate' || field === 'expectedDeliveryDate'
                    ? (req.body[field] ? new Date(req.body[field]) : null)
                    : req.body[field];
            }
        }
        if (!isConfirmed) enquiry.expectedDeliveryDate = null;

        await enquiry.save();
        await enquiry.populate('customer', 'companyName code contactPerson phone email');

        return res.status(200).json({ success: true, message: 'Order enquiry updated successfully.', data: enquiry });
    } catch (error) {
        console.error('Error in updateOrderEnquiry:', error);
        if (error.name === 'CastError') {
            return res.status(400).json({ success: false, message: `Invalid ID format for field '${error.path}'.` });
        }
        return res.status(400).json({ success: false, message: error.message || 'Failed to update order enquiry.' });
    }
};

/**
 * @desc    Soft-delete an Order Enquiry
 * @route   DELETE /api/crm/enquiries/:id
 * @access  Private (SALES:DELETE)
 */
const deleteOrderEnquiry = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({ success: false, message: 'Tenant context is missing or invalid.' });
        }

        const enquiry = await OrderEnquiry.findOne({ _id: req.params.id, tenant: tenantId });
        if (!enquiry) {
            return res.status(404).json({ success: false, message: 'Order enquiry not found.' });
        }

        enquiry.isActive = false;
        await enquiry.save();

        return res.status(200).json({ success: true, message: 'Order enquiry deleted successfully.' });
    } catch (error) {
        console.error('Error in deleteOrderEnquiry:', error);
        return res.status(500).json({ success: false, message: 'Failed to delete order enquiry.', error: error.message });
    }
};

/**
 * @desc    Add follow-up to an Order Enquiry (creates standalone CustomerInteraction)
 * @route   POST /api/crm/enquiries/:id/follow-ups
 * @access  Private (SALES:UPDATE)
 */
const addFollowUp = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        const enquiry = await OrderEnquiry.findById(req.params.id);
        if (!enquiry) {
            return res.status(404).json({ success: false, message: 'Order enquiry not found.' });
        }

        const { date, communicationType, type, notes, nextFollowUpDate, status } = req.body;
        const commType = communicationType || type || 'Phone Call';

        const interaction = new CustomerInteraction({
            tenant: tenantId || enquiry.tenant,
            customer: enquiry.customerRef || enquiry.customer || null,
            customerName: enquiry.newCustomerDetails?.company || enquiry.newCustomerDetails?.name || undefined,
            enquiryId: enquiry._id,
            referenceId: enquiry._id,
            date: date ? new Date(date) : new Date(),
            interactionType: commType || 'Phone Call',
            subject: `Follow-up: ${enquiry.nslNumber || 'Enquiry'}`,
            notes: notes || '',
            status: status || 'OPEN',
            assignedExecutive: req.user?._id || req.user?.id || undefined,
            nextFollowUpDate: nextFollowUpDate ? new Date(nextFollowUpDate) : null,
            isActive: true
        });

        await interaction.save();

        return res.status(201).json({
            success: true,
            message: 'Follow-up logged successfully as interaction.',
            data: interaction
        });
    } catch (error) {
        console.error('Error in addFollowUp:', error);
        return res.status(500).json({ success: false, message: 'Failed to add follow-up.', error: error.message });
    }
};

/**
 * @desc    Update SO Approval Status for Order Enquiry
 * @route   PUT/PATCH /api/crm/enquiries/:id/so-approval-status
 * @access  Private (SALES:UPDATE permission)
 */
const updateSOApprovalStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const updatedEnquiry = await Enquiry.findByIdAndUpdate(id, { soApprovalStatus: status }, { new: true });
        // If you have a notification service, trigger it here: sendNotificationToAdmin('SO Approval Requested', ...)
        res.status(200).json({ success: true, data: updatedEnquiry });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updateSOApprovalStatus = updateSOApprovalStatus;

module.exports = {
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
};
