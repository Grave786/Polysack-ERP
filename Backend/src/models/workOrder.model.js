const mongoose = require('mongoose');

const WorkOrderStageSchema = new mongoose.Schema({
    stageName: {
        type: String,
        required: true,
        enum: [
            'TAPE_EXTRUSION',
            'CIRCULAR_WEAVING',
            'EXTRUSION_LAMINATION',
            'FLEXO_PRINTING',
            'CUTTING_SEWING',
            'STITCHING',
            'HANDLE_ATTACHMENT',
            'BALING_PACKING'
        ]
    },
    sequence: {
        type: Number,
        required: true,
        min: 1,
        max: 8
    },
    status: {
        type: String,
        default: 'PENDING',
        enum: ['PENDING', 'SKIPPED', 'ACTIVE', 'COMPLETED']
    },
    machine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine',
        default: null
    },
    goodOutputQty: {
        type: Number,
        default: 0,
        min: 0
    },
    rejectedQty: {
        type: Number,
        default: 0,
        min: 0
    },
    startedAt: {
        type: Date,
        default: null
    },
    completedAt: {
        type: Date,
        default: null
    }
}, { _id: false });

const JobOrderFileSchema = new mongoose.Schema({
    name: { type: String, trim: true },
    size: { type: Number },
    fileType: { type: String, trim: true },
    data: { type: String } // Base64 data URL or storage URL
}, { _id: false });

const RollSpecificationSchema = new mongoose.Schema({
    rollNumber: {
        type: String,
        required: [true, 'Roll Number is required'],
        trim: true,
        maxlength: [50, 'Roll Number cannot exceed 50 characters']
    },
    fabricLength: {
        type: Number,
        default: null,
        min: [1, 'Fabric Length must be at least 1 Meter'],
        max: [50000, 'Fabric Length cannot exceed 50000 Meters']
    },
    width: {
        type: Number,
        default: null,
        min: [0, 'Width cannot be negative']
    },
    grossWeight: {
        type: Number,
        default: null,
        min: [0.01, 'Gross Weight must be at least 0.01 Kg'],
        max: [10000, 'Gross Weight cannot exceed 10000 Kg']
    },
    netWeight: {
        type: Number,
        default: null,
        min: [0.01, 'Net Weight must be at least 0.01 Kg'],
        max: [10000, 'Net Weight cannot exceed 10000 Kg']
    },
    totalQuantityKg: {
        type: Number,
        default: null,
        min: [0, 'Total quantity in Kgs cannot be negative']
    },
    totalQuantityPcs: {
        type: Number,
        default: null,
        min: [0, 'Total quantity in Pcs cannot be negative']
    }
}, { _id: true });

const JobOrderDetailsSchema = new mongoose.Schema({
    rolls: {
        type: [RollSpecificationSchema],
        default: []
    },
    orderDate: {
        type: Date,
        default: Date.now
    },
    productCategory: {
        type: String,
        enum: ['Print', 'Plain', ''],
        default: 'Print'
    },
    jobDescriptionPrintColours: {
        type: String,
        trim: true,
        default: ''
    },
    jobDescriptionPrintSide: {
        type: String,
        trim: true,
        default: ''
    },
    materialQualityFabric: {
        type: String,
        trim: true,
        default: ''
    },
    fabricLaminationType: {
        type: String,
        trim: true,
        default: ''
    },
    materialColour: {
        type: String,
        trim: true,
        default: ''
    },
    printingColour: {
        type: String,
        trim: true,
        default: ''
    },
    fabricGrammage: {
        type: String,
        trim: true,
        default: ''
    },
    bagWeightGms: {
        type: Number,
        min: [0, 'Bag weight cannot be negative'],
        default: null
    },
    fabricAverage: {
        type: String,
        trim: true,
        default: ''
    },
    fabricSizeInInch: {
        width: { type: Number, min: 0, default: null },
        length: { type: Number, min: 0, default: null }
    },
    customerContactNumber: {
        type: String,
        trim: true,
        default: ''
    },
    contactPersonName: {
        type: String,
        trim: true,
        default: ''
    },
    contactPersonDesignation: {
        type: String,
        trim: true,
        default: ''
    },
    totalOrderQuantity: {
        type: Number,
        min: [0, 'Total order quantity cannot be negative'],
        default: null
    },
    totalOrderQuantityUnit: {
        type: String,
        enum: ['Pcs', 'Kgs', 'Bags'],
        default: 'Pcs'
    },
    orderConfirmed: {
        type: Boolean,
        default: false
    },
    expectedDeliveryDate: {
        type: Date,
        default: null
    },
    purchaseOrderFiles: {
        type: [JobOrderFileSchema],
        default: []
    }
}, { _id: false });

const WorkOrderSchema = new mongoose.Schema({
    tenant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: [true, 'Tenant is required']
    },
    workOrderNumber: {
        type: String,
        required: [true, 'Work Order Number is required'],
        trim: true,
        uppercase: true
    },
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        required: [true, 'Customer is required']
    },
    finishedGood: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'FinishedGood',
        required: [true, 'Finished Good is required']
    },
    bom: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BOM',
        required: [true, 'BOM reference is required']
    },
    targetQuantity: {
        type: Number,
        required: [true, 'Target Quantity is required'],
        min: [1, 'Target Quantity must be at least 1']
    },
    completedQuantity: {
        type: Number,
        default: 0,
        min: 0
    },
    progressPercentage: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    priority: {
        type: String,
        default: 'MEDIUM',
        enum: ['LOW', 'MEDIUM', 'HIGH']
    },
    status: {
        type: String,
        default: 'PENDING',
        enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']
    },
    assignedMachine: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Machine',
        default: null
    },
    stages: {
        type: [WorkOrderStageSchema],
        validate: {
            validator: function (v) {
                return Array.isArray(v) && v.length === 8;
            },
            message: 'WorkOrder must have exactly 8 stages.'
        }
    },
    jobOrderDetails: {
        type: JobOrderDetailsSchema,
        default: () => ({})
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

WorkOrderSchema.methods.recalculateProgress = function () {
    const activeOrCompleted = (this.stages || []).filter((s) => s.status !== 'SKIPPED');
    const totalActiveCount = activeOrCompleted.length || 1;
    const completedCount = activeOrCompleted.filter((s) => s.status === 'COMPLETED').length;
    this.progressPercentage = Math.min(100, Math.round((completedCount / totalActiveCount) * 100));
    return this.progressPercentage;
};

WorkOrderSchema.index({ workOrderNumber: 1, tenant: 1 }, { unique: true });
WorkOrderSchema.index({ tenant: 1, createdAt: 1 });
WorkOrderSchema.index({ tenant: 1, assignedMachine: 1 });

module.exports = mongoose.model('WorkOrder', WorkOrderSchema);
