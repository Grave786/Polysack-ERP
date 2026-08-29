/**
 * Universal Bulk Delete Helper for PolySack ERP
 * Handles soft deletion, tenant scoping, immutable record protection, and user self-protection.
 */

const normalizeTenantId = (val) => {
    if (!val) return null;
    if (typeof val === 'object') {
        if (val._id) return String(val._id);
        if (val.id) return String(val.id);
    }
    return String(val);
};

/**
 * Creates an Express controller handler for bulk soft-deleting documents in a Mongoose model.
 * 
 * @param {Mongoose.Model} Model - The Mongoose model to perform bulk delete on
 * @param {Object} options - Configuration options
 * @param {boolean} options.isImmutable - If true, rejects deletion with 400 error
 * @param {boolean} options.isUser - If true, protects logged in user from deleting own account
 * @param {string} options.resourceName - Human-friendly name of the resource (e.g. 'Customers')
 * @param {string} options.statusField - Optional status field to update (e.g. 'status', 'isActive')
 */
const createBulkDeleteHandler = (Model, options = {}) => {
    return async (req, res) => {
        try {
            const rawTenantId = req.user?.tenant;
            const tenantId = normalizeTenantId(rawTenantId);

            if (!tenantId && req.user?.role?.name !== 'SUPER_ADMIN') {
                return res.status(403).json({
                    success: false,
                    message: 'Tenant context is missing or invalid. Please log in again.'
                });
            }

            // 1. Immutable Record Protection
            if (options.isImmutable) {
                return res.status(400).json({
                    success: false,
                    message: `${options.resourceName || 'This record type'} is an immutable audit record and cannot be deleted.`
                });
            }

            const { ids } = req.body;
            if (!Array.isArray(ids) || ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a non-empty array of record IDs to delete.'
                });
            }

            let validIds = ids.map(String);
            let skippedCount = 0;
            let skippedReason = '';

            // 2. User Self-Protection
            if (options.isUser) {
                const currentUserId = String(req.user?.userId || req.user?._id || req.user?.id || '');
                const selfIdx = validIds.indexOf(currentUserId);
                if (selfIdx !== -1) {
                    validIds.splice(selfIdx, 1);
                    skippedCount++;
                    skippedReason = 'cannot delete your own account';
                }
            }

            // If all IDs were skipped
            if (validIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    deletedCount: 0,
                    skippedCount,
                    skippedReason: skippedReason || 'No eligible records to delete.',
                    message: `0 deleted. ${skippedCount} skipped (${skippedReason}).`
                });
            }

            // 3. Tenant-scoped filter
            const filter = { _id: { $in: validIds } };
            if (tenantId) {
                filter.tenant = tenantId;
            }

            // 4. Perform Soft Delete (isActive: false)
            const updatePayload = { isActive: false };
            if (options.statusField) {
                updatePayload[options.statusField] = options.statusValue || 'INACTIVE';
            }

            const updateResult = await Model.updateMany(filter, { $set: updatePayload });
            const deletedCount = updateResult.modifiedCount || updateResult.matchedCount || validIds.length;

            return res.status(200).json({
                success: true,
                deletedCount,
                skippedCount,
                skippedReason: skippedReason || undefined,
                message: skippedCount > 0
                    ? `${deletedCount} record(s) deactivated. ${skippedCount} skipped (${skippedReason}).`
                    : `${deletedCount} record(s) deactivated successfully.`
            });
        } catch (error) {
            console.error(`Error in bulk delete for ${options.resourceName || 'resource'}:`, error);
            return res.status(500).json({
                success: false,
                message: `Failed to bulk delete ${options.resourceName || 'records'}.`,
                error: error.message
            });
        }
    };
};

module.exports = {
    createBulkDeleteHandler,
    normalizeTenantId
};
