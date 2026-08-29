const Notification = require('../models/notification.model');
const RawMaterial = require('../models/rawMaterial.model');
const PurchaseOrder = require('../models/purchaseOrder.model');

/**
 * Checks a RawMaterial document against reorderLevel and generates a LOW_STOCK notification
 * if crossing into low stock territory. Resets alert flag and resolves notifications if stock recovers.
 */
const checkAndTriggerLowStockAlert = async (rawMaterialDoc, sessionOption = {}) => {
    try {
        if (!rawMaterialDoc || !rawMaterialDoc.tenant) return;

        const currentStock = Number(rawMaterialDoc.currentStock || 0);
        const reorderLevel = Number(rawMaterialDoc.reorderLevel || 0);

        // Condition: Stock is at or below reorder level
        if (currentStock <= reorderLevel) {
            // Deduplication: Check if an active unread LOW_STOCK notification already exists for this RM
            const existingUnreadNotif = await Notification.findOne({
                tenant: rawMaterialDoc.tenant,
                type: 'LOW_STOCK',
                'data.rawMaterialId': rawMaterialDoc._id,
                isRead: false
            });

            if (!existingUnreadNotif) {
                // Populate UOM symbol if needed
                let uomSymbol = 'Kg';
                if (rawMaterialDoc.uom && typeof rawMaterialDoc.uom === 'object' && (rawMaterialDoc.uom.symbol || rawMaterialDoc.uom.name)) {
                    uomSymbol = rawMaterialDoc.uom.symbol || rawMaterialDoc.uom.name;
                } else if (rawMaterialDoc.uom) {
                    try {
                        const UOM = require('../models/uom.model');
                        const uDoc = await UOM.findById(rawMaterialDoc.uom).select('symbol name');
                        if (uDoc) uomSymbol = uDoc.symbol || uDoc.name || 'Kg';
                    } catch (e) {
                        // fallback
                    }
                }

                const notificationData = {
                    tenant: rawMaterialDoc.tenant,
                    type: 'LOW_STOCK',
                    module: 'INVENTORY',
                    title: `Low Stock Alert: ${rawMaterialDoc.name} (${rawMaterialDoc.code})`,
                    message: `Current stock of ${rawMaterialDoc.name} (${rawMaterialDoc.code}) is ${currentStock.toLocaleString('en-IN')} ${uomSymbol}, at or below the reorder level of ${reorderLevel.toLocaleString('en-IN')} ${uomSymbol}.`,
                    priority: currentStock === 0 ? 'CRITICAL' : 'HIGH',
                    data: {
                        rawMaterialId: rawMaterialDoc._id,
                        code: rawMaterialDoc.code,
                        name: rawMaterialDoc.name,
                        currentStock,
                        reorderLevel,
                        uom: uomSymbol
                    },
                    link: `/inventory?tab=raw-materials&search=${encodeURIComponent(rawMaterialDoc.code)}`,
                    isRead: false
                };

                if (sessionOption?.session) {
                    await Notification.create([notificationData], { session: sessionOption.session });
                } else {
                    await Notification.create(notificationData);
                }

                rawMaterialDoc.isLowStockAlerted = true;
                rawMaterialDoc.lastLowStockAlertAt = new Date();
                if (sessionOption?.session) {
                    await rawMaterialDoc.save({ session: sessionOption.session });
                } else {
                    await rawMaterialDoc.save();
                }

                console.log(`🚨 [NOTIFICATION] Low Stock Notification created for ${rawMaterialDoc.code} (${currentStock}/${reorderLevel} ${uomSymbol})`);
            }
        } else if (currentStock > reorderLevel) {
            // Stock recovered above threshold -> Reset alert flag & mark unread alerts as resolved/read
            if (rawMaterialDoc.isLowStockAlerted) {
                rawMaterialDoc.isLowStockAlerted = false;
                rawMaterialDoc.lastLowStockAlertAt = null;
                if (sessionOption?.session) {
                    await rawMaterialDoc.save({ session: sessionOption.session });
                } else {
                    await rawMaterialDoc.save();
                }
                console.log(`✅ [NOTIFICATION] Stock replenished for ${rawMaterialDoc.code} (${currentStock} > ${reorderLevel}). Alert flag reset.`);
            }

            await Notification.updateMany(
                { tenant: rawMaterialDoc.tenant, type: 'LOW_STOCK', 'data.rawMaterialId': rawMaterialDoc._id, isRead: false },
                { $set: { isRead: true, readAt: new Date() } }
            );
        }
    } catch (err) {
        console.error('Error in checkAndTriggerLowStockAlert:', err);
    }
};

/**
 * Scan all active RawMaterials for a tenant to backfill notifications for any existing
 * low-stock materials that do not yet have an active unread notification.
 */
const syncLowStockNotifications = async (tenantId) => {
    try {
        if (!tenantId) return;

        // Find raw materials with currentStock <= reorderLevel
        const lowStockItems = await RawMaterial.find({
            tenant: tenantId,
            isActive: true,
            $expr: { $lte: ['$currentStock', '$reorderLevel'] }
        }).populate('uom', 'name symbol');

        for (const rm of lowStockItems) {
            const existingNotif = await Notification.findOne({
                tenant: tenantId,
                type: 'LOW_STOCK',
                'data.rawMaterialId': rm._id,
                isRead: false
            });

            if (!existingNotif) {
                await checkAndTriggerLowStockAlert(rm);
            }
        }

        // Also sync any unalerted pending POs
        const pendingPOs = await PurchaseOrder.find({
            tenant: tenantId,
            status: 'PENDING_APPROVAL'
        }).populate('supplier', 'name');

        for (const po of pendingPOs) {
            const existingNotif = await Notification.findOne({
                tenant: tenantId,
                type: 'PO_APPROVAL',
                'data.poId': po._id,
                isRead: false
            });

            if (!existingNotif) {
                await createPoApprovalNotification(po);
            }
        }
    } catch (err) {
        console.error('Error in syncLowStockNotifications:', err);
    }
};

/**
 * Create a PO_APPROVAL notification
 */
const createPoApprovalNotification = async (poDoc) => {
    try {
        if (!poDoc || !poDoc.tenant) return;

        const supplierName = poDoc.supplier?.name || 'Assigned Supplier';
        await Notification.create({
            tenant: poDoc.tenant,
            type: 'PO_APPROVAL',
            module: 'PROCUREMENT',
            title: `PO Pending Approval: ${poDoc.poNumber}`,
            message: `Purchase Order ${poDoc.poNumber} from supplier ${supplierName} is waiting for management approval.`,
            priority: 'HIGH',
            data: {
                poId: poDoc._id,
                poNumber: poDoc.poNumber,
                supplierName,
                totalValue: poDoc.totalValue
            },
            link: '/procurement',
            isRead: false
        });
        console.log(`📋 [NOTIFICATION] PO Approval notification created for ${poDoc.poNumber}`);
    } catch (err) {
        console.error('Error creating PO approval notification:', err);
    }
};

/**
 * Mark PO approval notification as read/resolved
 */
const resolvePoApprovalNotification = async (poId, tenantId) => {
    try {
        if (!poId || !tenantId) return;
        await Notification.updateMany(
            { tenant: tenantId, type: 'PO_APPROVAL', 'data.poId': poId },
            { $set: { isRead: true, readAt: new Date() } }
        );
    } catch (err) {
        console.error('Error resolving PO approval notification:', err);
    }
};

module.exports = {
    checkAndTriggerLowStockAlert,
    syncLowStockNotifications,
    createPoApprovalNotification,
    resolvePoApprovalNotification
};
