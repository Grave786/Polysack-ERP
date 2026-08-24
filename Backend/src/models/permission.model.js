const mongoose = require('mongoose');

const PermissionSchema = new mongoose.Schema({
    module: {
        type: String,
        required: true,
        enum: ['INVENTORY', 'PRODUCTION', 'PROCUREMENT', 'SALES', 'MASTER_DATA', 'USERS', 'ROLES']
    },
    action: {
        type: String,
        required: true,
        enum: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE']
    },
    description: {
        type: String
    }
}, { timestamps: true });

// Ensure unique module and action combination
PermissionSchema.index({ module: 1, action: 1 }, { unique: true });

module.exports = mongoose.model('Permission', PermissionSchema);