const mongoose = require('mongoose');

const StockTransactionSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    referenceNumber: {
        type: String,
        required: [true, 'Reference number is required'],
        trim: true
    },
    itemType: {
        type: String,
        required: [true, 'Item type is required'],
        enum: {
            values: ['RAW_MATERIAL', 'FINISHED_GOOD'],
            message: '{VALUE} is not a valid item type.'
        }
    },
    itemModel: {
        type: String,
        required: true,
        enum: ['RawMaterial', 'FinishedGood']
    },
    item: {
        type: mongoose.Schema.Types.ObjectId,
        required: [true, 'Item reference is required'],
        refPath: 'itemModel'
    },
    transactionType: {
        type: String,
        required: [true, 'Transaction type is required'],
        enum: {
            values: [
                'STOCK_IN',
                'STOCK_OUT',
                'TRANSFER',
                'PRODUCTION_CONSUMPTION',
                'PRODUCTION_OUTPUT',
                'PRODUCTION_OUTPUT_PENDING_QC',
                'QC_PASSED',
                'QC_REJECTED',
                'POS_SALE',
                'ADJUSTMENT',
                'OPENING_BALANCE'
            ],
            message: '{VALUE} is not a valid transaction type.'
        }
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0.000001, 'Quantity must be greater than 0']
    },
    previousStock: {
        type: Number,
        default: 0
    },
    newStock: {
        type: Number,
        default: 0
    },
    fromLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    },
    toLocation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Location',
        default: null
    },
    batchNumber: {
        type: String,
        trim: true
    },
    notes: {
        type: String,
        trim: true
    },
    performedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Performed by user is required']
    }
}, { timestamps: true });

// Pre-validate hook to automatically keep itemModel aligned with itemType
StockTransactionSchema.pre('validate', function (next) {
    if (this.itemType === 'RAW_MATERIAL') {
        this.itemModel = 'RawMaterial';
    } else if (this.itemType === 'FINISHED_GOOD') {
        this.itemModel = 'FinishedGood';
    }
    next();
});

StockTransactionSchema.index({ tenant: 1, transactionType: 1, createdAt: 1 });

module.exports = mongoose.model('StockTransaction', StockTransactionSchema);
