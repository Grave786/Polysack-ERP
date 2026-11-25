const mongoose = require('mongoose');
const OrderEnquiry = require('../models/orderEnquiry.model');
const Customer = require('../models/customer.model');
const CustomerInteraction = require('../models/customerInteraction.model');
const Notification = require('../models/notification.model');
const Tenant = require('../models/tenant.model');
const User = require('../models/user.model');
const Approval = require('../models/approval.model');
const { notifyApprovers } = require('../services/approval.service');

// ── In-Memory IP Rate Limiter (No external packages needed) ──────────────────
const ipRateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS_PER_WINDOW = 10; // Max 10 submissions per IP per 15 minutes

// Periodic cleanup of stale rate limit entries (every 10 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [ip, record] of ipRateLimitMap.entries()) {
        if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
            ipRateLimitMap.delete(ip);
        }
    }
}, 10 * 60 * 1000);

const isRateLimited = (ip) => {
    const now = Date.now();
    const record = ipRateLimitMap.get(ip);
    if (!record || now - record.startTime > RATE_LIMIT_WINDOW_MS) {
        ipRateLimitMap.set(ip, { count: 1, startTime: now });
        return false;
    }
    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
        return true;
    }
    record.count++;
    return false;
};

class PublicEnquiryConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PublicEnquiryConfigError';
    }
}

/**
 * Strictly resolve the configured target tenant for public website enquiries.
 * Uses ONLY process.env.PUBLIC_ENQUIRY_TENANT_ID and never falls back to another tenant.
 */
const resolveConfiguredPublicTenant = async () => {
    const rawTenantId = (process.env.PUBLIC_ENQUIRY_TENANT_ID || '').trim();
    if (!rawTenantId || !mongoose.Types.ObjectId.isValid(rawTenantId)) {
        throw new PublicEnquiryConfigError(
            'PUBLIC_ENQUIRY_TENANT_ID is missing or is not a valid MongoDB ObjectId.'
        );
    }

    const tenantDoc = await Tenant.findOne({
        _id: new mongoose.Types.ObjectId(rawTenantId),
        isActive: true
    })
        .select('_id companyName name isActive')
        .lean();

    if (!tenantDoc) {
        throw new PublicEnquiryConfigError(
            `Configured PUBLIC_ENQUIRY_TENANT_ID (${rawTenantId}) does not match any active tenant.`
        );
    }

    return tenantDoc._id;
};

/**
 * Find an active Tenant Admin (or active user) of the configured tenant to act as
 * the system/requester reference required by ApprovalSchema.
 */
const findTenantApproverRequesterId = async (tenantId) => {
    const users = await User.find({ tenant: tenantId, isActive: true })
        .populate('role', 'name')
        .sort({ createdAt: 1 })
        .lean();

    const adminUser = users.find((u) => {
        const rName = (u.role?.name || u.roleName || '').toLowerCase();
        return rName === 'tenant admin' || rName === 'admin';
    });

    return (adminUser || users[0])?._id || null;
};

/**
 * @desc    Submit Public Website "Contact Sales" / "Get a Quote" Enquiry
 * @route   POST /api/public/enquiries
 * @access  Public (No Auth required)
 */
const submitPublicEnquiry = async (req, res) => {
    try {
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

        // 1. Rate Limiting Check
        if (isRateLimited(clientIp)) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests from your IP. Please wait a few minutes before submitting another enquiry.'
            });
        }

        // 2. Honeypot Anti-Spam Check (hidden fields)
        if (req.body.website || req.body.fax || req.body.hp_check || req.body.company_tax_id) {
            return res.status(200).json({
                success: true,
                message: 'Thank you! Your enquiry has been received. Our sales team will get in touch with you shortly.',
                data: { enquiryNumber: `NSL-${new Date().getFullYear()}-0001` }
            });
        }

        // 3. Resolve Tenant Context strictly from server configuration
        const tenantId = await resolveConfiguredPublicTenant();

        // 4. Sanitize and Validate Inputs (never read tenant, createdBy, status, approval, or source from body)
        const rawName = String(req.body.fullName || req.body.name || '').trim();
        const rawCompany = String(req.body.companyName || req.body.company || '').trim();
        const rawPhone = String(req.body.mobileNumber || req.body.phone || '').trim();
        const rawEmail = String(req.body.email || '').trim().toLowerCase();
        const rawCity = String(req.body.city || '').trim();
        const rawState = String(req.body.state || '').trim();
        const rawCityState = String(req.body.cityState || '').trim();
        const rawProduct = String(req.body.productInterestedIn || req.body.product || '').trim();
        const rawQty = req.body.approxQuantity !== undefined ? req.body.approxQuantity : req.body.quantity;
        const rawUnit = String(req.body.quantityUnit || req.body.unit || 'Pcs').trim();
        const rawLocation = String(req.body.deliveryLocation || req.body.location || '').trim();
        const rawMessage = String(req.body.message || req.body.requirement || '').trim();
        const rawBagDetails = typeof req.body.bagDetails === 'object' && req.body.bagDetails !== null ? req.body.bagDetails : {};

        if (!rawName || rawName.length < 2 || rawName.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid full name (2 to 100 characters).'
            });
        }

        const digitsOnlyPhone = rawPhone.replace(/\D/g, '');
        const cleanPhone = digitsOnlyPhone.length > 10 ? digitsOnlyPhone.slice(-10) : digitsOnlyPhone;
        if (!cleanPhone || !/^[6-9]\d{9}$/.test(cleanPhone)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid 10-digit mobile number (+91).'
            });
        }

        if (rawEmail && (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail) || rawEmail.length > 100)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address or leave it blank.'
            });
        }

        if (!rawMessage || rawMessage.length < 3 || rawMessage.length > 1500) {
            return res.status(400).json({
                success: false,
                message: 'Please describe your requirement or packaging details (up to 1500 characters).'
            });
        }

        const fullName = rawName.slice(0, 100);
        const companyName = rawCompany.slice(0, 150);
        const email = rawEmail.slice(0, 100);
        const city = (rawCity || (rawCityState.split(',')[0] || '')).trim().slice(0, 60);
        const state = (rawState || (rawCityState.split(',')[1] || '')).trim().slice(0, 60);
        const product = rawProduct.slice(0, 100);
        const deliveryLocation = rawLocation.slice(0, 150);
        const message = rawMessage.slice(0, 1500);

        let parsedQty = null;
        if (rawQty !== undefined && rawQty !== null && rawQty !== '') {
            const num = Number(rawQty);
            if (!isNaN(num) && num > 0) {
                parsedQty = num;
            }
        }
        const unit = ['Pcs', 'Kg', 'Bags', 'Roll'].includes(rawUnit) ? rawUnit : (rawUnit.slice(0, 15) || 'Pcs');

        const specParts = [];
        if (rawBagDetails.size) specParts.push(`Size: ${String(rawBagDetails.size).trim()}`);
        if (rawBagDetails.gsm) specParts.push(`GSM: ${String(rawBagDetails.gsm).trim()}`);
        if (rawBagDetails.lamination) specParts.push(`Lamination: ${String(rawBagDetails.lamination).trim()}`);
        if (rawBagDetails.printing) specParts.push(`Printing: ${String(rawBagDetails.printing).trim()}`);
        const bagSpecsText = specParts.length > 0 ? specParts.join(' | ') : 'Standard Specification';

        // 5. Generate NSL Sequence Reference Number (same series & helper as CRM NSLs)
        const nslNumber = await OrderEnquiry.generateNextNslNumber(tenantId);

        // 6. Check for Duplicate / Existing Customer or Lead scoped strictly to tenantId
        const phoneRegex = new RegExp(`${cleanPhone}$`);
        const emailFilter = email ? [{ email }] : [];
        const newCustEmailFilter = email ? [{ 'newCustomerDetails.email': email }] : [];

        const [existingCustomer, existingEnquiry] = await Promise.all([
            Customer.findOne({
                tenant: tenantId,
                isActive: true,
                $or: [
                    { phone: phoneRegex },
                    ...emailFilter
                ]
            }),
            OrderEnquiry.findOne({
                tenant: tenantId,
                isActive: true,
                $or: [
                    { 'newCustomerDetails.phone': phoneRegex },
                    { contactNumber: phoneRegex },
                    ...newCustEmailFilter
                ]
            }).sort({ createdAt: -1 })
        ]);

        if (existingCustomer || existingEnquiry) {
            const linkedCustId = existingCustomer?._id || existingEnquiry?.customer || existingEnquiry?.customerRef || null;
            const custDisplayName = existingCustomer?.companyName || existingEnquiry?.newCustomerDetails?.company || fullName;

            await CustomerInteraction.create({
                tenant: tenantId,
                customer: linkedCustId,
                customerName: custDisplayName,
                enquiryId: existingEnquiry?._id || undefined,
                interactionType: 'Website',
                subject: `Website Re-Enquiry: ${product || 'PP Packaging'} (${nslNumber})`,
                notes: `[Online Lead Ref: ${nslNumber}]\nProspect Name: ${fullName}\nCompany: ${companyName || 'Not specified'}\nPhone: ${cleanPhone}\nEmail: ${email || 'N/A'}\nProduct: ${product || 'Not specified'}\nQuantity: ${parsedQty ? parsedQty.toLocaleString('en-IN') : 'N/A'} ${unit}\nCity/State: ${[city, state].filter(Boolean).join(', ')}\nDelivery To: ${deliveryLocation || 'N/A'}\nSpecs: ${bagSpecsText}\nRequirement:\n${message}`,
                status: 'OPEN',
                date: new Date()
            });

            if (existingEnquiry) {
                existingEnquiry.repeatEnquiryCount = (existingEnquiry.repeatEnquiryCount || 0) + 1;
                if (!Array.isArray(existingEnquiry.followUps)) existingEnquiry.followUps = [];
                existingEnquiry.followUps.push({
                    date: new Date(),
                    communicationType: 'Website',
                    type: 'Website Re-Enquiry',
                    notes: `Repeat website enquiry [${nslNumber}] received for ${product || 'packaging'}: "${message}"`
                });
                await existingEnquiry.save();
            }

            try {
                await Notification.create({
                    tenant: tenantId,
                    type: 'NEW_ENQUIRY',
                    module: 'CRM',
                    title: `Repeat Website Enquiry: ${existingEnquiry?.nslNumber || nslNumber}`,
                    message: `${fullName} (${companyName || 'Individual'}, ${cleanPhone}) re-enquired via website for ${product || 'PP Woven Bags'} (${parsedQty ? parsedQty.toLocaleString('en-IN') + ' ' + unit : 'Requirement logged'}).`,
                    priority: 'HIGH',
                    link: existingEnquiry?._id ? `/customer-crm?tab=enquiries&id=${existingEnquiry._id}` : '/customer-crm?tab=enquiries',
                    data: {
                        enquiryNumber: existingEnquiry?.nslNumber || nslNumber,
                        nslNumber: existingEnquiry?.nslNumber || nslNumber,
                        phone: cleanPhone,
                        email,
                        isRepeat: true,
                        enquiryId: existingEnquiry?._id
                    }
                });
            } catch (notifErr) {
                console.error('[submitPublicEnquiry] Non-fatal error creating repeat enquiry notification:', notifErr.message);
            }

            return res.status(200).json({
                success: true,
                message: 'Thank you! Your enquiry has been received. Our sales team will get in touch with you shortly.',
                data: {
                    enquiryNumber: existingEnquiry?.nslNumber || nslNumber,
                    nslNumber: existingEnquiry?.nslNumber || nslNumber
                }
            });
        }

        // 7. NEW ENQUIRY: Create OrderEnquiry (NSL) + Approval in a transaction
        const isPlain = /plain|unlaminated/i.test(product) || /plain/i.test(rawBagDetails.printing || '');
        const requesterId = await findTenantApproverRequesterId(tenantId);
        const approvalNo = await Approval.generateNextApprovalNo(tenantId);

        const enquiryPayload = {
            tenant: tenantId,
            nslNumber,
            enquiryNumber: nslNumber,
            source: 'Website',
            customerType: 'New',
            newCustomerDetails: {
                name: fullName,
                company: companyName || fullName,
                phone: cleanPhone,
                email: email || ''
            },
            contactPerson: fullName,
            contactNumber: cleanPhone,
            city,
            state,
            deliveryLocation,
            productCategory: isPlain ? 'Plain' : 'Print',
            printSpec: {
                printSides: isPlain ? 'NONE' : '',
                frontColours: 0,
                backColours: 0
            },
            materialQualityFabric: product || '',
            fabricLaminationType: rawBagDetails.lamination ? String(rawBagDetails.lamination).trim() : '',
            fabricGrammage: rawBagDetails.gsm ? String(rawBagDetails.gsm).trim() : '',
            totalOrderQuantity: parsedQty,
            orderQuantity: parsedQty,
            quantityUnit: unit,
            description: `[Website Enquiry - Ref: ${nslNumber}]\nProduct: ${product || 'PP Woven Bags'}\nQuantity: ${parsedQty ? parsedQty.toLocaleString('en-IN') : 'N/A'} ${unit}\nLocation: ${deliveryLocation || [city, state].filter(Boolean).join(', ') || 'N/A'}\nSpecs: ${bagSpecsText}\nClient Requirement:\n${message}`,
            remarks: `Website Enquiry: ${nslNumber}`,
            status: 'Pending Approval',
            soApprovalStatus: 'Pending Approval',
            bagDetails: rawBagDetails,
            enquiryDate: new Date(),
            orderConfirmed: false,
            isActive: true
        };

        let newEnquiry = null;
        let createdApproval = null;

        const session = await mongoose.startSession();
        try {
            await session.withTransaction(async () => {
                const [savedEnquiry] = await OrderEnquiry.create([enquiryPayload], { session });
                newEnquiry = savedEnquiry;

                if (requesterId) {
                    const [savedApproval] = await Approval.create([{
                        tenant: new mongoose.Types.ObjectId(tenantId),
                        approvalNo,
                        type: 'NSL',
                        referenceModel: 'OrderEnquiry',
                        referenceId: savedEnquiry._id,
                        referenceNo: savedEnquiry.nslNumber,
                        title: `Website Lead Approval: ${savedEnquiry.nslNumber}`,
                        summary: `${fullName} (${companyName || 'New Prospect'}) | ${product || 'PP Sacks'} | ${parsedQty ? parsedQty.toLocaleString('en-IN') + ' ' + unit : 'Bulk Order'}`,
                        requestedBy: requesterId,
                        status: 'Pending',
                        reminderCount: 0,
                        nextReminderAt: new Date(Date.now() + 2 * 60 * 60 * 1000)
                    }], { session });
                    createdApproval = savedApproval;
                } else {
                    console.warn(`[submitPublicEnquiry] No active user found for tenant ${tenantId}; Approval record skipped.`);
                }
            });
        } finally {
            await session.endSession();
        }

        // 8. Fire Notifications (non-fatal: never fail visitor submission if notification fails)
        try {
            if (createdApproval) {
                await notifyApprovers(tenantId, createdApproval);
            }

            await Notification.create({
                tenant: tenantId,
                type: 'NEW_ENQUIRY',
                module: 'CRM',
                title: `New Website Enquiry: ${nslNumber}`,
                message: `${fullName} (${companyName || 'New Prospect'}, ${cleanPhone}) enquired for ${product || 'PP Woven Sacks'} (${parsedQty ? parsedQty.toLocaleString('en-IN') + ' ' + unit : 'Requirement logged'}) [${nslNumber}].`,
                priority: 'HIGH',
                link: `/customer-crm?tab=enquiries&id=${newEnquiry._id}`,
                data: {
                    enquiryNumber: nslNumber,
                    nslNumber,
                    phone: cleanPhone,
                    email,
                    enquiryId: newEnquiry._id,
                    approvalId: createdApproval?._id
                }
            });
        } catch (notifErr) {
            console.error('[submitPublicEnquiry] Non-fatal error creating notifications:', notifErr.message);
        }

        return res.status(201).json({
            success: true,
            message: 'Thank you! Your enquiry has been received. Our sales team will get in touch with you shortly.',
            data: {
                enquiryNumber: nslNumber,
                nslNumber
            }
        });

    } catch (error) {
        if (error instanceof PublicEnquiryConfigError) {
            console.error('[Public Enquiry Config Error]', error.message);
            return res.status(503).json({
                success: false,
                message: 'Enquiries are temporarily unavailable'
            });
        }

        console.error('Error in submitPublicEnquiry:', error);
        return res.status(500).json({
            success: false,
            message: 'We could not process your enquiry at this moment. Please try calling our sales office directly.'
        });
    }
};

/**
 * @desc    Get public whitelisted company details for the marketing website
 * @route   GET /api/public/company-info
 * @access  Public (No Auth required)
 */
const getPublicCompanyInfo = async (req, res) => {
    try {
        const clientIp = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
        if (isRateLimited(clientIp)) {
            return res.status(429).json({
                success: false,
                message: 'Too many requests from your IP. Please try again shortly.'
            });
        }

        const tenantId = await resolveConfiguredPublicTenant();

        const tenant = await Tenant.findOne({ _id: tenantId, isActive: true })
            .select('name companyName contactPhone phone contactEmail email registeredAddress stateName gstin logoUrl')
            .lean();

        if (!tenant) {
            throw new PublicEnquiryConfigError(
                `Configured PUBLIC_ENQUIRY_TENANT_ID (${tenantId}) does not match any active tenant.`
            );
        }

        const addr = tenant.registeredAddress || {};
        const data = {
            companyName: (tenant.companyName || tenant.name || '').trim(),
            phone: (tenant.contactPhone || tenant.phone || '').trim(),
            email: (tenant.contactEmail || tenant.email || '').trim(),
            addressLine1: (addr.line1 || '').trim(),
            addressLine2: (addr.line2 || '').trim(),
            city: (addr.city || '').trim(),
            state: (tenant.stateName || '').trim(),
            pincode: (addr.pincode || '').trim(),
            gstin: (tenant.gstin || '').trim(),
            logoUrl: (tenant.logoUrl || '').trim()
        };

        res.set('Cache-Control', 'public, max-age=60');
        return res.status(200).json({
            success: true,
            message: 'Company information retrieved successfully.',
            data
        });
    } catch (error) {
        if (error instanceof PublicEnquiryConfigError) {
            console.error('[Public Company Info Config Error]', error.message);
            return res.status(503).json({
                success: false,
                message: 'Company information is temporarily unavailable'
            });
        }

        console.error('Error in getPublicCompanyInfo:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Unable to load company information.'
        });
    }
};

module.exports = {
    submitPublicEnquiry,
    getPublicCompanyInfo,
    resolveConfiguredPublicTenant,
    PublicEnquiryConfigError
};
