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

const app = express();
app.use(cors());
app.use(express.json());

// Boot check to ensure permissions are seeded
const initializeSystem = async () => {
  await connectDB();
  try {
    const count = await Permission.countDocuments();
    const EXPECTED_PERMISSIONS_COUNT = 35;
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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));