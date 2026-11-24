const FinishedGood = require('../models/finishedGood.model');
const Category = require('../models/category.model');
const UOM = require('../models/uom.model');
const Location = require('../models/location.model');
const BOM = require('../models/bom.model');
const RawMaterial = require('../models/rawMaterial.model');
const { generateCsv, sendCsvResponse } = require('../utils/csvExport');

/**
 * @desc    Create a new Finished Good (along with its Material Requirements / Recipe)
 * @route   POST /api/finished-goods
 * @access  Private (INVENTORY:CREATE permission)
 */
const createFinishedGood = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        // Always strip currentStock and tenant from body
        delete req.body.currentStock;
        delete req.body.tenant;

        const {
            code,
            name,
            category,
            uom,
            defaultLocation,
            fabricGSM,
            bagShape,
            dimensions,
            dimensionUnit,
            bagCapacity,
            pricePerBag,
            isActive
        } = req.body;

        const rawMaterialReqs = req.body.materialRequirements || req.body.rawMaterials || req.body.recipe || req.body.components || [];

        // 1. Basic validation
        if (!code || !name || !category || !uom) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields: code, name, category, and uom.'
            });
        }

        // 2. Validate Material Requirements (BOM Recipe)
        if (!Array.isArray(rawMaterialReqs) || rawMaterialReqs.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please define at least one Raw Material requirement (recipe) for this Finished Good.'
            });
        }

        const validRecipeItems = [];
        const seenRawMaterialIds = new Set();

        for (const item of rawMaterialReqs) {
            const rmId = item.rawMaterial?._id || item.rawMaterial;
            const qty = Number(item.quantityPerUnit !== undefined ? item.quantityPerUnit : item.quantity);

            if (!rmId || isNaN(qty) || qty <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Each raw material requirement must have a valid Raw Material selected and a quantity greater than 0.'
                });
            }

            const rmIdStr = String(rmId);
            if (seenRawMaterialIds.has(rmIdStr)) {
                return res.status(400).json({
                    success: false,
                    message: 'Duplicate raw material found in recipe. Please specify each material once.'
                });
            }
            seenRawMaterialIds.add(rmIdStr);

            const rmDoc = await RawMaterial.findOne({ _id: rmId, tenant: tenantId });
            if (!rmDoc) {
                return res.status(400).json({
                    success: false,
                    message: `Raw Material does not exist or does not belong to your organization.`
                });
            }

            validRecipeItems.push({
                rawMaterial: rmId,
                quantityPerUnit: qty
            });
        }

        const formattedCode = String(code).trim().toUpperCase();
        const formattedName = String(name).trim();

        // 3. Validate tenant-ownership of referenced models
        const categoryDoc = await Category.findOne({ _id: category, tenant: tenantId });
        if (!categoryDoc) {
            return res.status(400).json({
                success: false,
                message: 'Category does not exist or does not belong to your organization.'
            });
        }

        const uomDoc = await UOM.findOne({ _id: uom, tenant: tenantId });
        if (!uomDoc) {
            return res.status(400).json({
                success: false,
                message: 'UOM does not exist or does not belong to your organization.'
            });
        }

        if (defaultLocation) {
            const locationDoc = await Location.findOne({ _id: defaultLocation, tenant: tenantId });
            if (!locationDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Default location does not exist or does not belong to your organization.'
                });
            }
        }

        // 4. Duplicate checks
        const existingCode = await FinishedGood.findOne({ code: formattedCode, tenant: tenantId });
        if (existingCode) {
            return res.status(400).json({
                success: false,
                message: `A Finished Good with code '${formattedCode}' already exists in your organization.`
            });
        }

        const existingName = await FinishedGood.findOne({ name: formattedName, tenant: tenantId });
        if (existingName) {
            return res.status(400).json({
                success: false,
                message: `A Finished Good with name '${formattedName}' already exists in your organization.`
            });
        }

        // 5. Create FinishedGood
        const selectedUnit = (dimensions && dimensions.unit) || dimensionUnit || 'cm';
        const formattedDimensions = dimensions ? {
            width: Number(dimensions.width || 0),
            length: Number(dimensions.length || 0),
            unit: selectedUnit
        } : undefined;

        const gsmRaw = fabricGSM !== undefined ? fabricGSM : (req.body.gsm !== undefined ? req.body.gsm : req.body.fabricGsm);
        const gsmVal = (gsmRaw !== undefined && gsmRaw !== '' && gsmRaw !== null && !isNaN(Number(gsmRaw))) ? Number(gsmRaw) : null;
        const capVal = bagCapacity !== undefined ? bagCapacity : req.body.capacity;
        const weightVal = req.body.bagWeightGms !== undefined ? req.body.bagWeightGms : (req.body.tareWeightGram !== undefined ? req.body.tareWeightGram : req.body.bagWeight);
        const numWeight = (weightVal !== undefined && weightVal !== '' && weightVal !== null && !isNaN(Number(weightVal))) ? Number(weightVal) : 0;

        const finishedGood = new FinishedGood({
            code: formattedCode,
            name: formattedName,
            baseName: req.body.baseName || '',
            category,
            uom,
            defaultLocation: defaultLocation || null,
            fabricGSM: gsmVal !== null ? gsmVal : undefined,
            bagShape,
            dimensions: formattedDimensions,
            dimensionUnit: selectedUnit,
            bagCapacity: (capVal !== undefined && capVal !== '' && capVal !== null && !isNaN(Number(capVal))) ? Number(capVal) : undefined,
            bagWeightGms: numWeight,
            tareWeightGram: numWeight,
            bagType: req.body.bagType || 'Laminated PP Woven Sack',
            pricePerBag: pricePerBag !== undefined ? Number(pricePerBag) : 0,
            inks: Array.isArray(req.body.inks) ? req.body.inks.filter(Boolean) : (Array.isArray(req.body.inksUsed) ? req.body.inksUsed : []),
            storageBayLocation: req.body.storageBayLocation !== undefined ? req.body.storageBayLocation : (req.body.warehouseLocation || ''),
            warehouseLocation: req.body.warehouseLocation || req.body.storageBayLocation || 'Finished Goods Warehouse - Bay 1',
            isActive: isActive !== undefined ? isActive : true,
            tenant: tenantId
        });

        await finishedGood.save();

        // 6. Create default active BOM Document
        const bomDoc = new BOM({
            tenant: tenantId,
            finishedGood: finishedGood._id,
            name: `${formattedName} Recipe`,
            items: validRecipeItems,
            isActive: true,
            isDefault: true
        });

        await bomDoc.save();

        await finishedGood.populate([
            { path: 'category', select: 'name type' },
            { path: 'uom', select: 'name symbol type' },
            { path: 'defaultLocation', select: 'name code type' }
        ]);

        const responseData = finishedGood.toObject();
        responseData.materialRequirements = validRecipeItems;

        return res.status(201).json({
            success: true,
            message: 'Finished Good and its Material Requirements saved successfully.',
            data: responseData
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in createFinishedGood:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to create Finished Good.',
            error: error.message
        });
    }
};

/**
 * @desc    Get all Finished Goods scoped to user's tenant
 * @route   GET /api/finished-goods
 * @access  Private (INVENTORY:READ permission)
 */
const getFinishedGoods = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const { category, uom, bagShape, status, isActive, search, page = 1, limit = 20 } = req.query;

        const filter = { tenant: tenantId };

        if (category) {
            filter.category = category;
        }

        if (uom) {
            filter.uom = uom;
        }

        if (bagShape) {
            filter.bagShape = bagShape;
        }

        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') filter.isActive = true;
            else if (status === 'Inactive' || status === 'INACTIVE') filter.isActive = false;
        } else if (isActive !== undefined) {
            filter.isActive = isActive === 'true' || isActive === true;
        }

        if (search) {
            const trimmedSearch = search.trim();
            const gsmNormalizedSearch = trimmedSearch.replace(/\b(?:GSM|GMS)\b/gi, '(?:GSM|GMS)');
            const searchOr = [
                { name: { $regex: gsmNormalizedSearch, $options: 'i' } },
                { code: { $regex: trimmedSearch, $options: 'i' } }
            ];
            const numVal = parseFloat(trimmedSearch.replace(/\b(?:GSM|GMS)\b/gi, '').trim());
            if (!isNaN(numVal)) {
                searchOr.push({ fabricGSM: numVal });
            }
            filter.$or = searchOr;
        }

        const pageNum = Math.max(1, parseInt(page, 10) || 1);
        const limitNum = Math.max(1, parseInt(limit, 10) || 20);
        const skip = (pageNum - 1) * limitNum;

        const [items, total] = await Promise.all([
            FinishedGood.find(filter)
                .populate('category', 'name type')
                .populate('uom', 'name symbol type')
                .populate('defaultLocation', 'name code type')
                .sort({ code: 1 })
                .skip(skip)
                .limit(limitNum),
            FinishedGood.countDocuments(filter)
        ]);

        // Attach linked active default BOM recipe items to each Finished Good
        const fgIds = items.map((f) => f._id);
        const boms = await BOM.find({ finishedGood: { $in: fgIds }, tenant: tenantId, isActive: true })
            .populate('items.rawMaterial', 'name code uom currentStock materialGrade color pricePerUnit');

        const bomMap = new Map();
        boms.forEach((b) => {
            const fgKey = String(b.finishedGood);
            if (!bomMap.has(fgKey) || b.isDefault) {
                bomMap.set(fgKey, b);
            }
        });

        const enrichedItems = items.map((fg) => {
            const fgObj = fg.toObject ? fg.toObject({ virtuals: true }) : { ...fg };
            const linkedBom = bomMap.get(String(fg._id));
            fgObj.materialRequirements = linkedBom ? linkedBom.items : [];

            // Fallback GSM resolution if fabricGSM is missing
            if (fgObj.fabricGSM === undefined || fgObj.fabricGSM === null) {
                if (fgObj.gsm !== undefined && fgObj.gsm !== null) {
                    fgObj.fabricGSM = fgObj.gsm;
                } else if (fgObj.fabricGrammage) {
                    const num = Number(String(fgObj.fabricGrammage).replace(/[^0-9.]/g, ''));
                    if (!isNaN(num) && num > 0) fgObj.fabricGSM = num;
                } else if (typeof fgObj.name === 'string') {
                    const match = fgObj.name.match(/(\d+(?:\.\d+)?)\s*(?:GSM|GMS)/i);
                    if (match) fgObj.fabricGSM = Number(match[1]);
                }
            }
            fgObj.gsm = fgObj.fabricGSM;
            fgObj.fabricGsm = fgObj.fabricGSM;

            return fgObj;
        });

        return res.status(200).json({
            success: true,
            count: items.length,
            pagination: {
                total,
                page: pageNum,
                limit: limitNum,
                pages: Math.ceil(total / limitNum) || 1
            },
            data: enrichedItems
        });
    } catch (error) {
        console.error('Error in getFinishedGoods:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch Finished Goods.',
            error: error.message
        });
    }
};

/**
 * @desc    Export Finished Goods to CSV
 * @route   GET /api/finished-goods/export
 * @access  Private (INVENTORY:READ permission)
 */
const exportFinishedGoods = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing.'
            });
        }

        const { category, uom, bagShape, status, isActive, search } = req.query;
        const filter = { tenant: tenantId };

        if (category) filter.category = category;
        if (uom) filter.uom = uom;
        if (bagShape) filter.bagShape = bagShape;
        if (status && status !== 'All' && status !== 'ALL') {
            if (status === 'Active' || status === 'ACTIVE') filter.isActive = true;
            else if (status === 'Inactive' || status === 'INACTIVE') filter.isActive = false;
        } else if (isActive !== undefined) filter.isActive = isActive === 'true' || isActive === true;
        if (search) {
            const trimmedSearch = search.trim();
            const gsmNormalizedSearch = trimmedSearch.replace(/\b(?:GSM|GMS)\b/gi, '(?:GSM|GMS)');
            const searchOr = [
                { name: { $regex: gsmNormalizedSearch, $options: 'i' } },
                { code: { $regex: trimmedSearch, $options: 'i' } }
            ];
            const numVal = parseFloat(trimmedSearch.replace(/\b(?:GSM|GMS)\b/gi, '').trim());
            if (!isNaN(numVal)) {
                searchOr.push({ fabricGSM: numVal });
            }
            filter.$or = searchOr;
        }

        const items = await FinishedGood.find(filter)
            .populate('category', 'name')
            .sort({ code: 1 });

        const fields = [
            { label: 'Product Code', key: 'code' },
            { label: 'Product Specification', key: 'name' },
            { label: 'Bag Type', key: (f) => (typeof f.category === 'object' ? f.category?.name : f.category) || '' },
            { label: 'Bag Shape', key: (f) => f.bagShape || 'Flat' },
            { label: 'GSM', key: (f) => {
                const g = f.fabricGSM ?? f.gsm ?? f.fabricGsm;
                if (g !== undefined && g !== null && g !== '') return g;
                if (typeof f.name === 'string') {
                    const match = f.name.match(/(\d+(?:\.\d+)?)\s*(?:GSM|GMS)/i);
                    if (match) return match[1];
                }
                return '';
            }},
            { label: 'Dimensions', key: (f) => f.dimensions?.width && f.dimensions?.length ? `${f.dimensions.width}x${f.dimensions.length} ${f.dimensions?.unit || f.dimensionUnit || 'cm'}` : '' },
            { label: 'Bag Capacity (Kg)', key: (f) => f.bagCapacity || '' },
            { label: 'Price Per Bag (INR)', key: (f) => f.pricePerBag || 0 },
            { label: 'Current Stock', key: (f) => f.currentStock || 0 },
            { label: 'Is Active', key: (f) => f.isActive !== false ? 'Active' : 'Inactive' }
        ];

        const csvContent = generateCsv(items, fields);
        return sendCsvResponse(res, `finished_goods_export_${Date.now()}.csv`, csvContent);
    } catch (error) {
        console.error('Error in exportFinishedGoods:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to export finished goods to CSV.'
        });
    }
};

/**
 * @desc    Get Finished Good by ID scoped to user's tenant
 * @route   GET /api/finished-goods/:id
 * @access  Private (INVENTORY:READ permission)
 */
const getFinishedGoodById = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const finishedGood = await FinishedGood.findOne({ _id: req.params.id, tenant: tenantId })
            .populate('category', 'name type')
            .populate('uom', 'name symbol type')
            .populate('defaultLocation', 'name code type');

        if (!finishedGood) {
            return res.status(404).json({
                success: false,
                message: 'Finished Good not found.'
            });
        }

        const linkedBom = await BOM.findOne({ finishedGood: finishedGood._id, tenant: tenantId, isActive: true, isDefault: true })
            .populate('items.rawMaterial', 'name code uom currentStock materialGrade color pricePerUnit');

        const fallbackBom = !linkedBom ? await BOM.findOne({ finishedGood: finishedGood._id, tenant: tenantId, isActive: true })
            .populate('items.rawMaterial', 'name code uom currentStock materialGrade color pricePerUnit') : null;

        const responseData = finishedGood.toObject ? finishedGood.toObject({ virtuals: true }) : finishedGood;
        responseData.materialRequirements = (linkedBom || fallbackBom)?.items || [];

        // Fallback GSM resolution if fabricGSM is missing
        if (responseData.fabricGSM === undefined || responseData.fabricGSM === null) {
            if (responseData.gsm !== undefined && responseData.gsm !== null) {
                responseData.fabricGSM = responseData.gsm;
            } else if (responseData.fabricGrammage) {
                const num = Number(String(responseData.fabricGrammage).replace(/[^0-9.]/g, ''));
                if (!isNaN(num) && num > 0) responseData.fabricGSM = num;
            } else if (typeof responseData.name === 'string') {
                const match = responseData.name.match(/(\d+(?:\.\d+)?)\s*(?:GSM|GMS)/i);
                if (match) responseData.fabricGSM = Number(match[1]);
            }
        }
        responseData.gsm = responseData.fabricGSM;
        responseData.fabricGsm = responseData.fabricGSM;

        return res.status(200).json({
            success: true,
            data: responseData
        });
    } catch (error) {
        console.error('Error in getFinishedGoodById:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to retrieve Finished Good.',
            error: error.message
        });
    }
};

/**
 * @desc    Update Finished Good scoped to user's tenant (currentStock is read-only)
 * @route   PUT /api/finished-goods/:id
 * @access  Private (INVENTORY:UPDATE permission)
 */
const updateFinishedGood = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const finishedGood = await FinishedGood.findOne({ _id: req.params.id, tenant: tenantId });
        if (!finishedGood) {
            return res.status(404).json({
                success: false,
                message: 'Finished Good not found.'
            });
        }

        // Always strip currentStock and tenant from body
        delete req.body.currentStock;
        delete req.body.tenant;

        const {
            code,
            name,
            category,
            uom,
            defaultLocation,
            fabricGSM,
            bagShape,
            dimensions,
            dimensionUnit,
            bagCapacity,
            pricePerBag,
            isActive
        } = req.body;

        const rawMaterialReqs = req.body.materialRequirements || req.body.rawMaterials || req.body.recipe || req.body.components;

        if (code) {
            const formattedCode = String(code).trim().toUpperCase();
            if (formattedCode !== finishedGood.code) {
                const existingCode = await FinishedGood.findOne({
                    code: formattedCode,
                    tenant: tenantId,
                    _id: { $ne: finishedGood._id }
                });
                if (existingCode) {
                    return res.status(400).json({
                        success: false,
                        message: `A Finished Good with code '${formattedCode}' already exists in your organization.`
                    });
                }
                finishedGood.code = formattedCode;
            }
        }

        if (name && name.trim() !== finishedGood.name) {
            const formattedName = name.trim();
            const existingName = await FinishedGood.findOne({
                name: formattedName,
                tenant: tenantId,
                _id: { $ne: finishedGood._id }
            });
            if (existingName) {
                return res.status(400).json({
                    success: false,
                    message: `A Finished Good with name '${formattedName}' already exists in your organization.`
                });
            }
            finishedGood.name = formattedName;
        }

        if (category && String(category) !== String(finishedGood.category)) {
            const categoryDoc = await Category.findOne({ _id: category, tenant: tenantId });
            if (!categoryDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'Category does not exist or does not belong to your organization.'
                });
            }
            finishedGood.category = category;
        }

        if (uom && String(uom) !== String(finishedGood.uom)) {
            const uomDoc = await UOM.findOne({ _id: uom, tenant: tenantId });
            if (!uomDoc) {
                return res.status(400).json({
                    success: false,
                    message: 'UOM does not exist or does not belong to your organization.'
                });
            }
            finishedGood.uom = uom;
        }

        if (defaultLocation !== undefined) {
            if (defaultLocation) {
                const locationDoc = await Location.findOne({ _id: defaultLocation, tenant: tenantId });
                if (!locationDoc) {
                    return res.status(400).json({
                        success: false,
                        message: 'Default location does not exist or does not belong to your organization.'
                    });
                }
                finishedGood.defaultLocation = defaultLocation;
            } else {
                finishedGood.defaultLocation = null;
            }
        }

        const gsmRaw = fabricGSM !== undefined ? fabricGSM : (req.body.gsm !== undefined ? req.body.gsm : req.body.fabricGsm);
        if (gsmRaw !== undefined) {
            if (gsmRaw === '' || gsmRaw === null) {
                finishedGood.fabricGSM = null;
            } else if (!isNaN(Number(gsmRaw))) {
                finishedGood.fabricGSM = Number(gsmRaw);
            }
        }
        if (bagShape !== undefined) finishedGood.bagShape = bagShape;
        if (dimensions !== undefined) {
            const unit = dimensions.unit || dimensionUnit || finishedGood.dimensionUnit || finishedGood.dimensions?.unit || 'cm';
            finishedGood.dimensions = {
                width: Number(dimensions.width || 0),
                length: Number(dimensions.length || 0),
                unit
            };
            finishedGood.dimensionUnit = unit;
        } else if (dimensionUnit !== undefined) {
            finishedGood.dimensionUnit = dimensionUnit;
            if (finishedGood.dimensions) {
                finishedGood.dimensions.unit = dimensionUnit;
            }
        }
        const capVal = bagCapacity !== undefined ? bagCapacity : req.body.capacity;
        if (capVal !== undefined) {
            finishedGood.bagCapacity = (capVal !== '' && capVal !== null && !isNaN(Number(capVal))) ? Number(capVal) : undefined;
        }
        const weightVal = req.body.bagWeightGms !== undefined ? req.body.bagWeightGms : (req.body.tareWeightGram !== undefined ? req.body.tareWeightGram : req.body.bagWeight);
        if (weightVal !== undefined) {
            const numWeight = (weightVal !== '' && weightVal !== null && !isNaN(Number(weightVal))) ? Number(weightVal) : 0;
            finishedGood.bagWeightGms = numWeight;
            finishedGood.tareWeightGram = numWeight;
        }
        if (pricePerBag !== undefined) finishedGood.pricePerBag = Number(pricePerBag);
        if (req.body.baseName !== undefined) finishedGood.baseName = req.body.baseName;
        if (req.body.bagType !== undefined) finishedGood.bagType = req.body.bagType;
        if (req.body.inks !== undefined) {
            finishedGood.inks = Array.isArray(req.body.inks) ? req.body.inks.filter(Boolean) : [];
        } else if (req.body.inksUsed !== undefined) {
            finishedGood.inks = Array.isArray(req.body.inksUsed) ? req.body.inksUsed : [];
        }
        if (req.body.storageBayLocation !== undefined) finishedGood.storageBayLocation = req.body.storageBayLocation;
        if (req.body.warehouseLocation !== undefined) finishedGood.warehouseLocation = req.body.warehouseLocation;
        if (isActive !== undefined) finishedGood.isActive = isActive;

        await finishedGood.save();

        // If Material Requirements are provided, update or create the default active BOM
        let updatedRecipeItems = null;
        if (Array.isArray(rawMaterialReqs) && rawMaterialReqs.length > 0) {
            const validRecipeItems = [];
            const seenRawMaterialIds = new Set();

            for (const item of rawMaterialReqs) {
                const rmId = item.rawMaterial?._id || item.rawMaterial;
                const qty = Number(item.quantityPerUnit !== undefined ? item.quantityPerUnit : item.quantity);

                if (!rmId || isNaN(qty) || qty <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Each raw material requirement must have a valid Raw Material selected and a quantity greater than 0.'
                    });
                }

                const rmIdStr = String(rmId);
                if (seenRawMaterialIds.has(rmIdStr)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Duplicate raw material found in recipe. Please specify each material once.'
                    });
                }
                seenRawMaterialIds.add(rmIdStr);

                const rmDoc = await RawMaterial.findOne({ _id: rmId, tenant: tenantId });
                if (!rmDoc) {
                    return res.status(400).json({
                        success: false,
                        message: 'Raw Material does not exist or does not belong to your organization.'
                    });
                }

                validRecipeItems.push({
                    rawMaterial: rmId,
                    quantityPerUnit: qty
                });
            }

            let bomDoc = await BOM.findOne({ finishedGood: finishedGood._id, tenant: tenantId, isDefault: true, isActive: true });
            if (!bomDoc) {
                bomDoc = await BOM.findOne({ finishedGood: finishedGood._id, tenant: tenantId, isActive: true });
            }

            if (bomDoc) {
                bomDoc.items = validRecipeItems;
                bomDoc.name = `${finishedGood.name} Recipe`;
                bomDoc.isDefault = true;
                await bomDoc.save();
            } else {
                bomDoc = new BOM({
                    tenant: tenantId,
                    finishedGood: finishedGood._id,
                    name: `${finishedGood.name} Recipe`,
                    items: validRecipeItems,
                    isActive: true,
                    isDefault: true
                });
                await bomDoc.save();
            }
            updatedRecipeItems = validRecipeItems;
        }

        await finishedGood.populate([
            { path: 'category', select: 'name type' },
            { path: 'uom', select: 'name symbol type' },
            { path: 'defaultLocation', select: 'name code type' }
        ]);

        const responseData = finishedGood.toObject();
        if (updatedRecipeItems) {
            responseData.materialRequirements = updatedRecipeItems;
        }

        return res.status(200).json({
            success: true,
            message: 'Finished Good updated successfully.',
            data: responseData
        });
    } catch (error) {
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: error.message
            });
        }
        console.error('Error in updateFinishedGood:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update Finished Good.',
            error: error.message
        });
    }
};

/**
 * @desc    Soft delete Finished Good (isActive: false) scoped to user's tenant
 * @route   DELETE /api/finished-goods/:id
 * @access  Private (INVENTORY:DELETE permission)
 */
const deleteFinishedGood = async (req, res) => {
    try {
        const tenantId = req.user?.tenant;
        if (!tenantId) {
            return res.status(403).json({
                success: false,
                message: 'Tenant context is missing or invalid. Please log in again.'
            });
        }

        const finishedGood = await FinishedGood.findOne({ _id: req.params.id, tenant: tenantId });
        if (!finishedGood) {
            return res.status(404).json({
                success: false,
                message: 'Finished Good not found.'
            });
        }

        finishedGood.isActive = false;
        await finishedGood.save();

        return res.status(200).json({
            success: true,
            message: 'Finished Good deactivated successfully.',
            data: finishedGood
        });
    } catch (error) {
        console.error('Error in deleteFinishedGood:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to delete Finished Good.',
            error: error.message
        });
    }
};

module.exports = {
    createFinishedGood,
    getFinishedGoods,
    exportFinishedGoods,
    getFinishedGoodById,
    updateFinishedGood,
    deleteFinishedGood
};
