const mongoose = require('mongoose');

const MODULE_CONFIG = [
    { key: 'INVENTORY', label: 'Bag Inventory & Stock Master', description: 'Bag Inventory & Stock Master' },
    { key: 'PRODUCTION', label: 'Shop Floor & Work Orders', description: 'Shop Floor & Work Orders' },
    { key: 'PROCUREMENT', label: 'Purchase Orders & GRN Inward', description: 'Purchase Orders & GRN Inward' },
    { key: 'SALES', label: 'POS Billing & Sales Orders', description: 'POS Billing & Sales Orders' },
    { key: 'MASTER_DATA', label: 'Products, Raw Materials & Machines', description: 'Products, Raw Materials & Machines' },
    { key: 'USERS', label: 'User Accounts & Access Control', description: 'User Accounts & Access Control' },
    { key: 'ROLES', label: 'Roles & Permission Matrices', description: 'Roles & Permission Matrices' },
    { key: 'QUALITY', label: 'Quality Control & COA Certificates', description: 'Quality Control & COA Certificates' },
    { key: 'DISPATCH', label: 'Dispatch & Delivery', description: 'Delivery Challans, Shipments & Gate Passes' },
    { key: 'HR', label: 'Attendance & HR Management', description: 'Attendance, Shifts, Biometric Logs & Employees' },
    { key: 'ANALYTICS', label: 'Analytics & Reports', description: 'P&L, Yield, Inventory Valuation & GST Register' },
    { key: 'CRM', label: 'Customer CRM & Complaints', description: 'Order Enquiries, Follow-up Logs & Complaints' },
    { key: 'COMPANY_SETTINGS', label: 'Company Settings & GST Profile', description: 'Company Profile, GST & Configuration' }
];

const MODULES = [
    'INVENTORY',
    'PRODUCTION',
    'PROCUREMENT',
    'SALES',
    'MASTER_DATA',
    'USERS',
    'ROLES',
    'QUALITY',
    'APPROVALS',
    'DISPATCH',
    'HR',
    'ANALYTICS',
    'CRM',
    'COMPANY_SETTINGS'
];

const ACTIONS = ['CREATE', 'READ', 'UPDATE', 'DELETE', 'APPROVE'];

const PermissionSchema = new mongoose.Schema({
    module: {
        type: String,
        required: true,
        enum: MODULES
    },
    action: {
        type: String,
        required: true,
        enum: ACTIONS
    },
    description: {
        type: String
    }
}, { timestamps: true });

// Ensure unique module and action combination
PermissionSchema.index({ module: 1, action: 1 }, { unique: true });

const Permission = mongoose.model('Permission', PermissionSchema);

module.exports = Permission;
module.exports.MODULES = MODULES;
module.exports.ACTIONS = ACTIONS;
module.exports.MODULE_CONFIG = MODULE_CONFIG;