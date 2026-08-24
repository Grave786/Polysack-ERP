const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true
    },
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    parentCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        default: null
    },
    type: {
        type: String,
        required: [true, 'Category type is required'],
        enum: {
            values: ['RAW_MATERIAL', 'FINISHED_GOODS', 'CONSUMABLE', 'MACHINERY'],
            message: '{VALUE} is not a valid category type. Must be RAW_MATERIAL, FINISHED_GOODS, CONSUMABLE, or MACHINERY'
        }
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

// Compound unique index per tenant and parentCategory
CategorySchema.index({ name: 1, tenant: 1, parentCategory: 1 }, { unique: true });

// Helper method to detect self-parenting and circular hierarchy chains
CategorySchema.methods.validateHierarchy = async function () {
    if (!this.parentCategory) return;

    // 1. Prevent self-parenting
    if (this._id && this.parentCategory.toString() === this._id.toString()) {
        const err = new Error('A category cannot be its own parent category.');
        err.name = 'ValidationError';
        throw err;
    }

    // 2. Walk up ancestor tree to prevent circular references and cross-tenant parents
    let currentParentId = this.parentCategory;
    const visitedIds = new Set();

    if (this._id) {
        visitedIds.add(this._id.toString());
    }

    while (currentParentId) {
        const parentIdStr = currentParentId.toString();

        if (visitedIds.has(parentIdStr)) {
            const err = new Error('Circular hierarchy reference detected: a category cannot have one of its descendants as a parent.');
            err.name = 'ValidationError';
            throw err;
        }

        visitedIds.add(parentIdStr);

        const parentDoc = await this.constructor.findById(currentParentId).select('parentCategory tenant');
        if (!parentDoc) {
            const err = new Error('Specified parent category does not exist.');
            err.name = 'ValidationError';
            throw err;
        }

        if (this.tenant && parentDoc.tenant && parentDoc.tenant.toString() !== this.tenant.toString()) {
            const err = new Error('Parent category must belong to the same organization/tenant.');
            err.name = 'ValidationError';
            throw err;
        }

        currentParentId = parentDoc.parentCategory;
    }
};

// Pre-save hook executing hierarchy validation
CategorySchema.pre('save', async function (next) {
    try {
        await this.validateHierarchy();
        next();
    } catch (err) {
        next(err);
    }
});

module.exports = mongoose.model('Category', CategorySchema);
