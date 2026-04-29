const prisma = require('../utils/prisma');
const { Pool } = require('pg');

const pgPool = new Pool({
    connectionString: (process.env.DATABASE_URL || '').replace('postgres:admin@123@', 'postgres:admin%40123@')
});

async function pgQuery(sql, params = []) {
    const result = await pgPool.query(sql, params);
    return result.rows;
}

function toNumber(value, fallback = 0) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function toOptionalDate(value) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function adminMetadata(req, mode = 'update') {
    const name = req.admin?.name || req.admin?.adminRole || 'Admin';
    if (mode === 'create') {
        return {
            createdByAdminId: req.admin?.userId,
            createdByAdminName: name,
            updatedByAdminId: req.admin?.userId,
            updatedByAdminName: name
        };
    }

    return {
        updatedByAdminId: req.admin?.userId,
        updatedByAdminName: name
    };
}

function mapItem(row) {
    return {
        id: row.id,
        subCategoryId: row.subCategoryId,
        skuCode: row.skuCode,
        name: row.name,
        imageUrl: row.imageUrl,
        customerPrice: Number(row.customerPrice || 0),
        vendorShare: Number(row.vendorShare || 0),
        gstPercent: Number(row.gstPercent || 0),
        isActive: row.isActive,
        availableFrom: row.availableFrom,
        availableUntil: row.availableUntil,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        createdByAdminId: row.createdByAdminId,
        createdByAdminName: row.createdByAdminName,
        updatedByAdminId: row.updatedByAdminId,
        updatedByAdminName: row.updatedByAdminName
    };
}

// ============================================
// SERVICES CRUD
// ============================================

const getAllServices = async (req, res) => {
    try {
        const rows = await pgQuery('SELECT * FROM "Service" ORDER BY "displayOrder" ASC');
        const services = rows.map((row) => ({
            ...row,
            defaultCommissionPercent: Number(row.defaultCommissionPercent || 0),
            categories: []
        }));
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createService = async (req, res) => {
    try {
        const {
            name,
            slug,
            description,
            icon,
            color,
            displayOrder,
            isActive,
            defaultProcessingHours,
            expressOptionAllowed,
            surgePricingAllowed,
            defaultCommissionPercent
        } = req.body;

        if (!name || !String(name).trim()) {
            return res.status(400).json({ error: 'Service name is required' });
        }

        const service = await prisma.service.create({
            data: { 
                name: String(name).trim(),
                slug: slug || String(name).trim().toLowerCase().replace(/\s+/g, '-'),
                description,
                icon,
                color,
                displayOrder: toNumber(displayOrder, 0),
                isActive: isActive !== undefined ? isActive : true,
                defaultProcessingHours: toNumber(defaultProcessingHours, 72),
                expressOptionAllowed: expressOptionAllowed !== undefined ? expressOptionAllowed : true,
                surgePricingAllowed: surgePricingAllowed !== undefined ? surgePricingAllowed : true,
                defaultCommissionPercent: toNumber(defaultCommissionPercent, 18),
                ...adminMetadata(req, 'create')
            }
        });
        res.status(201).json(service);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateService = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            slug,
            description,
            icon,
            color,
            displayOrder,
            isActive,
            defaultProcessingHours,
            expressOptionAllowed,
            surgePricingAllowed,
            defaultCommissionPercent
        } = req.body;
        const data = adminMetadata(req);

        if (name !== undefined) data.name = String(name).trim();
        if (slug !== undefined) data.slug = slug;
        if (description !== undefined) data.description = description;
        if (icon !== undefined) data.icon = icon;
        if (color !== undefined) data.color = color;
        if (displayOrder !== undefined) data.displayOrder = toNumber(displayOrder, 0);
        if (isActive !== undefined) data.isActive = isActive;
        if (defaultProcessingHours !== undefined) data.defaultProcessingHours = toNumber(defaultProcessingHours, 72);
        if (expressOptionAllowed !== undefined) data.expressOptionAllowed = expressOptionAllowed;
        if (surgePricingAllowed !== undefined) data.surgePricingAllowed = surgePricingAllowed;
        if (defaultCommissionPercent !== undefined) data.defaultCommissionPercent = toNumber(defaultCommissionPercent, 18);

        const service = await prisma.service.update({
            where: { id },
            data
        });
        res.json(service);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.service.update({
            where: { id },
            data: {
                isActive: false,
                ...adminMetadata(req)
            }
        });

        res.json({ message: 'Service archived' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// CATEGORIES CRUD
// ============================================

const getAllCategories = async (req, res) => {
    try {
        const { serviceId } = req.query;
        const params = [];
        const where = serviceId ? 'WHERE c."serviceId" = $1' : '';
        if (serviceId) params.push(serviceId);
        const rows = await pgQuery(`
            SELECT c.*, row_to_json(s.*) AS service,
                COALESCE(json_agg(sc.* ORDER BY sc."displayOrder") FILTER (WHERE sc.id IS NOT NULL), '[]') AS "subCategories"
            FROM "Category" c
            LEFT JOIN "Service" s ON s.id = c."serviceId"
            LEFT JOIN "SubCategory" sc ON sc."categoryId" = c.id
            ${where}
            GROUP BY c.id, s.id
            ORDER BY c."displayOrder" ASC
        `, params);
        const categories = rows.map((row) => ({
            ...row,
            service: row.service,
            subCategories: row.subCategories || []
        }));
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createCategory = async (req, res) => {
    try {
        const { serviceId, name, icon, displayOrder, isActive } = req.body;

        if (!serviceId || !name || !String(name).trim()) {
            return res.status(400).json({ error: 'serviceId and category name are required' });
        }

        const category = await prisma.category.create({
            data: { 
                serviceId,
                name: String(name).trim(),
                icon, 
                displayOrder: toNumber(displayOrder, 0),
                isActive: isActive !== undefined ? isActive : true,
                ...adminMetadata(req, 'create')
            },
            include: { service: true, subCategories: true }
        });
        res.status(201).json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, icon, displayOrder, isActive } = req.body;
        const data = adminMetadata(req);

        if (name !== undefined) data.name = String(name).trim();
        if (icon !== undefined) data.icon = icon;
        if (displayOrder !== undefined) data.displayOrder = toNumber(displayOrder, 0);
        if (isActive !== undefined) data.isActive = isActive;

        const category = await prisma.category.update({
            where: { id },
            data,
            include: { service: true, subCategories: true }
        });
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.category.update({
            where: { id },
            data: {
                isActive: false,
                ...adminMetadata(req)
            }
        });
        
        res.json({ message: 'Category archived' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const reorderCategories = async (req, res) => {
    try {
        const { categories } = req.body; // [{id, displayOrder}, ...]
        await Promise.all(
            categories.map(c =>
                prisma.category.update({
                    where: { id: c.id },
                    data: { displayOrder: c.displayOrder }
                })
            )
        );
        res.json({ message: 'Categories reordered' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// SUBCATEGORIES CRUD
// ============================================

const getAllSubCategories = async (req, res) => {
    try {
        const { categoryId } = req.query;
        const params = [];
        const where = categoryId ? 'WHERE sc."categoryId" = $1' : '';
        if (categoryId) params.push(categoryId);
        const rows = await pgQuery(`
            SELECT sc.*,
                json_build_object(
                    'id', c.id,
                    'serviceId', c."serviceId",
                    'name', c.name,
                    'icon', c.icon,
                    'displayOrder', c."displayOrder",
                    'isActive', c."isActive",
                    'createdAt', c."createdAt",
                    'updatedAt', c."updatedAt",
                    'service', row_to_json(s.*)
                ) AS category,
                COALESCE(json_agg(i.* ORDER BY i."updatedAt" DESC) FILTER (WHERE i.id IS NOT NULL), '[]') AS items
            FROM "SubCategory" sc
            LEFT JOIN "Category" c ON c.id = sc."categoryId"
            LEFT JOIN "Service" s ON s.id = c."serviceId"
            LEFT JOIN "Item" i ON i."subCategoryId" = sc.id
            ${where}
            GROUP BY sc.id, c.id, s.id
            ORDER BY sc."displayOrder" ASC
        `, params);
        const subCategories = rows.map((row) => ({
            ...row,
            category: row.category,
            items: row.items || []
        }));
        res.json(subCategories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createSubCategory = async (req, res) => {
    try {
        const { categoryId, name, displayOrder, isActive } = req.body;

        if (!categoryId || !name || !String(name).trim()) {
            return res.status(400).json({ error: 'categoryId and subcategory name are required' });
        }

        const subCategory = await prisma.subCategory.create({
            data: { 
                categoryId,
                name: String(name).trim(), 
                displayOrder: toNumber(displayOrder, 0),
                isActive: isActive !== undefined ? isActive : true,
                ...adminMetadata(req, 'create')
            },
            include: {
                items: true,
                category: {
                    include: {
                        service: true
                    }
                }
            }
        });
        res.status(201).json(subCategory);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateSubCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, displayOrder, isActive } = req.body;
        const data = adminMetadata(req);

        if (name !== undefined) data.name = String(name).trim();
        if (displayOrder !== undefined) data.displayOrder = toNumber(displayOrder, 0);
        if (isActive !== undefined) data.isActive = isActive;

        const subCategory = await prisma.subCategory.update({
            where: { id },
            data,
            include: {
                items: true,
                category: {
                    include: {
                        service: true
                    }
                }
            }
        });
        res.json(subCategory);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteSubCategory = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.subCategory.update({
            where: { id },
            data: {
                isActive: false,
                ...adminMetadata(req)
            }
        });
        res.json({ message: 'Subcategory archived' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// ITEMS CRUD
// ============================================

const getAllItems = async (req, res) => {
    try {
        const { subCategoryId } = req.query;
        const params = [];
        const where = subCategoryId ? 'WHERE i."subCategoryId" = $1' : '';
        if (subCategoryId) params.push(subCategoryId);
        const rows = await pgQuery(`
            SELECT i.*,
                json_build_object(
                    'id', sc.id,
                    'categoryId', sc."categoryId",
                    'name', sc.name,
                    'displayOrder', sc."displayOrder",
                    'isActive', sc."isActive",
                    'createdAt', sc."createdAt",
                    'updatedAt', sc."updatedAt",
                    'category', json_build_object(
                        'id', c.id,
                        'serviceId', c."serviceId",
                        'name', c.name,
                        'icon', c.icon,
                        'displayOrder', c."displayOrder",
                        'isActive', c."isActive",
                        'createdAt', c."createdAt",
                        'updatedAt', c."updatedAt",
                        'service', row_to_json(s.*)
                    )
                ) AS "subCategory",
                COALESCE(json_agg(po.* ORDER BY po.priority DESC, po."updatedAt" DESC) FILTER (WHERE po.id IS NOT NULL), '[]') AS "priceOverrides"
            FROM "Item" i
            LEFT JOIN "SubCategory" sc ON sc.id = i."subCategoryId"
            LEFT JOIN "Category" c ON c.id = sc."categoryId"
            LEFT JOIN "Service" s ON s.id = c."serviceId"
            LEFT JOIN "ItemPriceOverride" po ON po."itemId" = i.id
            ${where}
            GROUP BY i.id, sc.id, c.id, s.id
            ORDER BY i."updatedAt" DESC
        `, params);
        const items = rows.map((row) => ({
            ...mapItem(row),
            subCategory: row.subCategory,
            priceOverrides: row.priceOverrides || []
        }));
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createItem = async (req, res) => {
    try {
        const {
            subCategoryId,
            name,
            skuCode,
            customerPrice,
            vendorShare,
            gstPercent,
            imageUrl,
            isActive,
            availableFrom,
            availableUntil
        } = req.body;

        if (!subCategoryId || !name || !String(name).trim()) {
            return res.status(400).json({ error: 'subCategoryId and item name are required' });
        }

        const item = await prisma.item.create({
            data: { 
                subCategoryId, 
                name: String(name).trim(),
                skuCode,
                customerPrice: toNumber(customerPrice, 0),
                vendorShare: toNumber(vendorShare, 0),
                gstPercent: toNumber(gstPercent, 0),
                imageUrl,
                isActive: isActive !== undefined ? isActive : true,
                availableFrom: toOptionalDate(availableFrom),
                availableUntil: toOptionalDate(availableUntil),
                ...adminMetadata(req, 'create')
            }
        });
        res.status(201).json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateItem = async (req, res) => {
    try {
        const { id } = req.params;
        const {
            name,
            skuCode,
            customerPrice,
            vendorShare,
            gstPercent,
            imageUrl,
            subCategoryId,
            isActive,
            availableFrom,
            availableUntil
        } = req.body;
        const data = adminMetadata(req);
        
        if (name !== undefined) data.name = String(name).trim();
        if (skuCode !== undefined) data.skuCode = skuCode;
        if (customerPrice !== undefined) data.customerPrice = toNumber(customerPrice, 0);
        if (vendorShare !== undefined) data.vendorShare = toNumber(vendorShare, 0);
        if (gstPercent !== undefined) data.gstPercent = toNumber(gstPercent, 0);
        if (imageUrl !== undefined) data.imageUrl = imageUrl;
        if (subCategoryId !== undefined) data.subCategoryId = subCategoryId;
        if (isActive !== undefined) data.isActive = isActive;
        if (availableFrom !== undefined) data.availableFrom = toOptionalDate(availableFrom);
        if (availableUntil !== undefined) data.availableUntil = toOptionalDate(availableUntil);

        const item = await prisma.item.update({ where: { id }, data });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.item.update({
            where: { id },
            data: {
                isActive: false,
                ...adminMetadata(req)
            }
        });
        res.json({ message: 'Item archived' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// BULK OPERATIONS
// ============================================

const bulkUploadItems = async (req, res) => {
    try {
        const { items } = req.body; // Array of item objects
        if (!Array.isArray(items)) return res.status(400).json({ error: 'Items array required' });

        const createdItems = [];
        for (const itemData of items) {
            const item = await prisma.item.create({
                data: {
                    ...itemData,
                    customerPrice: toNumber(itemData.customerPrice, 0),
                    vendorShare: toNumber(itemData.vendorShare, 0),
                    gstPercent: toNumber(itemData.gstPercent, 0),
                    availableFrom: toOptionalDate(itemData.availableFrom),
                    availableUntil: toOptionalDate(itemData.availableUntil),
                    ...adminMetadata(req, 'create')
                }
            });
            createdItems.push(item);
        }

        res.status(201).json({ count: createdItems.length, items: createdItems });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const bulkPriceUpdate = async (req, res) => {
    try {
        const { updates } = req.body; // Array of { id, customerPrice?, vendorShare?, gstPercent?, isActive?, subCategoryId? }
        if (!Array.isArray(updates)) return res.status(400).json({ error: 'Updates array required' });

        const results = await Promise.all(
            updates.map(u => {
                const data = adminMetadata(req);
                if (u.customerPrice !== undefined) data.customerPrice = toNumber(u.customerPrice, 0);
                if (u.vendorShare !== undefined) data.vendorShare = toNumber(u.vendorShare, 0);
                if (u.gstPercent !== undefined) data.gstPercent = toNumber(u.gstPercent, 0);
                if (u.isActive !== undefined) data.isActive = u.isActive;
                if (u.subCategoryId !== undefined) data.subCategoryId = u.subCategoryId;

                return prisma.item.update({
                    where: { id: u.id },
                    data
                });
            })
        );

        res.json({ count: results.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const pricePreview = async (req, res) => {
    try {
        const { items } = req.body; // [{ customerPrice, vendorShare }]
        const preview = items.map(item => {
            const price = toNumber(item.customerPrice, 0);
            const share = toNumber(item.vendorShare, 0);
            const gstPercent = toNumber(item.gstPercent, 0);
            const platformCommission = price - share;
            const gstAmount = platformCommission * (gstPercent / 100);
            return {
                customerPrice: price,
                vendorShare: share,
                gstPercent,
                platformCommission,
                gstAmount,
                netPlatformMargin: platformCommission - gstAmount,
                isLossMaking: share >= price,
                marginPercent: price > 0 ? (platformCommission / price) * 100 : 0
            };
        });
        res.json(preview);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllServices,
    createService,
    updateService,
    deleteService,
    
    getAllCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    reorderCategories,

    getAllSubCategories,
    createSubCategory,
    updateSubCategory,
    deleteSubCategory,
    
    getAllItems,
    createItem,
    updateItem,
    deleteItem,

    bulkUploadItems,
    bulkPriceUpdate,
    pricePreview
};
