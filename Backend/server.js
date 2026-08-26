const dotenv = require("dotenv");
dotenv.config();
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const mongoose = require("mongoose");
const path = require("path");
const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const connectDB = require('./src/config/db');
const Permission = require('./src/models/permission.model');

// Import Routes
const authRoutes = require('./src/routes/auth.routes');
const tenantRoutes = require('./src/routes/tenant.routes');
const roleRoutes = require('./src/routes/role.routes');
const userRoutes = require('./src/routes/user.routes');
const uomRoutes = require('./src/routes/uom.routes');
const categoryRoutes = require('./src/routes/category.routes');
const locationRoutes = require('./src/routes/location.routes');
const supplierRoutes = require('./src/routes/supplier.routes');
const rawMaterialRoutes = require('./src/routes/rawMaterial.routes');
const finishedGoodRoutes = require('./src/routes/finishedGood.routes');
const stockTransactionRoutes = require('./src/routes/stockTransaction.routes');
const machineRoutes = require('./src/routes/machine.routes');
const customerRoutes = require('./src/routes/customer.routes');
const bomRoutes = require('./src/routes/bom.routes');
const workOrderRoutes = require('./src/routes/workOrder.routes');
const purchaseOrderRoutes = require('./src/routes/purchaseOrder.routes');
const grnRoutes = require('./src/routes/grn.routes');
const salesOrderRoutes = require('./src/routes/salesOrder.routes');
const invoiceRoutes = require('./src/routes/invoice.routes');
const qcInspectionRoutes = require('./src/routes/qcInspection.routes');
const dispatchRoutes = require('./src/routes/dispatch.routes');
const posRoutes = require('./src/routes/pos.routes');
const companyProfileRoutes = require('./src/routes/companyProfile.routes');
const reportRoutes = require('./src/routes/report.routes');
const shiftRoutes = require('./src/routes/shift.routes');
const employeeRoutes = require('./src/routes/employee.routes');
const attendanceRoutes = require('./src/routes/attendance.routes');
const rosterRoutes = require('./src/routes/roster.routes');
const crmRoutes = require('./src/routes/crm.routes');
const analyticsRoutes = require('./src/routes/analytics.routes');
const dashboardRoutes = require('./src/routes/dashboard.routes');

const app = express();
app.use(cors());
app.use(express.json());

// Boot check to ensure permissions are seeded
const initializeSystem = async () => {
  await connectDB();

  // Synchronize MongoDB indexes for multi-tenancy across all registered schemas
  try {
    const models = mongoose.modelNames();
    for (const modelName of models) {
      try {
        await mongoose.model(modelName).syncIndexes();
      } catch (idxErr) {
        console.warn(`[Index Sync] Non-critical warning for model '${modelName}':`, idxErr.message);
      }
    }
    console.log('✅ MongoDB Indexes synchronized successfully for multi-tenancy.');
  } catch (syncErr) {
    console.warn('⚠️ Index sync error on boot:', syncErr.message);
  }

  try {
    const count = await Permission.countDocuments();
    const EXPECTED_PERMISSIONS_COUNT = 40;
    if (count < EXPECTED_PERMISSIONS_COUNT) {
      console.warn(`\x1b[33m⚠️ WARNING: Permission collection has missing entries! Expected ${EXPECTED_PERMISSIONS_COUNT}, found ${count}.\x1b[0m`);
      console.warn(`\x1b[33m👉 Please run: node src/scripts/permission.seed.js\x1b[0m`);
    } else {
      console.log(`✅ System Permissions verified (${count}/${EXPECTED_PERMISSIONS_COUNT}).`);
    }
  } catch (err) {
    console.warn('⚠️ Could not verify permission count on boot:', err.message);
  }
};

initializeSystem();

// Basic Health Check Route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'PolySack ERP Engine is running smoothly' });
});

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uom', uomRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/raw-materials', rawMaterialRoutes);
app.use('/api/finished-goods', finishedGoodRoutes);
app.use('/api/stock-transactions', stockTransactionRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/boms', bomRoutes);
app.use('/api/work-orders', workOrderRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/grns', grnRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/qc-inspections', qcInspectionRoutes);
app.use('/api/dispatches', dispatchRoutes);
app.use('/api/pos', posRoutes);
app.use('/api/admin/company-profile', companyProfileRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/shifts', shiftRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/rosters', rosterRoutes);
app.use('/api/crm', crmRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/dashboard', dashboardRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));