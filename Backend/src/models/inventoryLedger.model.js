const mongoose = require('mongoose');

const InventoryLedgerSchema = new mongoose.Schema({
  item_type: { 
    type: String, 
    enum: ['RAW_MATERIAL', 'FINISHED_PRODUCT'], 
    required: true 
  },
  item_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    required: true 
  },
  transaction_type: { 
    type: String, 
    required: true 
  },
  quantity: { 
    type: Number, 
    required: true 
  },
  reference_id: { 
    type: mongoose.Schema.Types.ObjectId // Link to GRN, WO, or Dispatch
  }
}, { timestamps: true });

module.exports = mongoose.model('InventoryLedger', InventoryLedgerSchema);