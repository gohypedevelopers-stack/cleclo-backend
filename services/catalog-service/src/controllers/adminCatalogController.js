const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================
// SERVICES CRUD
// ============================================

const getAllServices = async (req, res) => {
    try {
        const services = await prisma.service.findMany({
            include: {
                categories: {
                    orderBy: { displayOrder: 'asc' },
                    include: {
                        subCategories: {
                            orderBy: { displayOrder: 'asc' },
                            include: {
                                items: true
                            }
                        }
                    }
                }
            },
            orderBy: { displayOrder: 'asc' }
        });
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createService = async (req, res) => {
    try {
        const { name, slug, description, icon, displayOrder, isActive } = req.body;
        const service = await prisma.service.create({
            data: { 
                name, 
                slug: slug || name.toLowerCase().replace(/\s+/g, '-'),
                description,
                icon,
                displayOrder: displayOrder || 0,
                isActive: isActive !== undefined ? isActive : true,
                createdByAdminId: req.admin?.userId
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
        const { name, slug, description, icon, displayOrder, isActive } = req.body;
        const service = await prisma.service.update({
            where: { id },
            data: { 
                name, slug, description, icon, displayOrder, isActive,
                updatedByAdminId: req.admin?.userId
            }
        });
        res.json(service);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteService = async (req, res) => {
    try {
        const { id } = req.params;
        // Due to cascading relations handled manually:
        // Find categories
        const categories = await prisma.category.findMany({ where: { serviceId: id } });
        const catIds = categories.map(c => c.id);
        
        // Find subcategories
        const subCategories = await prisma.subCategory.findMany({ where: { categoryId: { in: catIds } } });
        const subCatIds = subCategories.map(sc => sc.id);

        // Delete items
        await prisma.item.deleteMany({ where: { subCategoryId: { in: subCatIds } } });
        // Delete subcategories
        await prisma.subCategory.deleteMany({ where: { categoryId: { in: catIds } } });
        // Delete categories
        await prisma.category.deleteMany({ where: { serviceId: id } });
        // Finally delete service
        await prisma.service.delete({ where: { id } });
        
        res.json({ message: 'Service deleted' });
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
        const where = serviceId ? { serviceId } : {};
        const categories = await prisma.category.findMany({
            where,
            include: { subCategories: true, service: true },
            orderBy: { displayOrder: 'asc' }
        });
        res.json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createCategory = async (req, res) => {
    try {
        const { serviceId, name, icon, displayOrder, isActive } = req.body;
        const category = await prisma.category.create({
            data: { 
                serviceId, name, icon, 
                displayOrder: displayOrder || 0,
                isActive: isActive !== undefined ? isActive : true,
                createdByAdminId: req.admin?.userId
            }
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
        const category = await prisma.category.update({
            where: { id },
            data: { 
                name, icon, displayOrder, isActive,
                updatedByAdminId: req.admin?.userId
            }
        });
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const subCategories = await prisma.subCategory.findMany({ where: { categoryId: id } });
        const subCatIds = subCategories.map(sc => sc.id);

        await prisma.item.deleteMany({ where: { subCategoryId: { in: subCatIds } } });
        await prisma.subCategory.deleteMany({ where: { categoryId: id } });
        await prisma.category.delete({ where: { id } });
        
        res.json({ message: 'Category deleted' });
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
        const where = categoryId ? { categoryId } : {};
        const subCategories = await prisma.subCategory.findMany({
            where,
            include: { items: true, category: true },
            orderBy: { displayOrder: 'asc' }
        });
        res.json(subCategories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createSubCategory = async (req, res) => {
    try {
        const { categoryId, name, displayOrder, isActive } = req.body;
        const subCategory = await prisma.subCategory.create({
            data: { 
                categoryId, name, 
                displayOrder: displayOrder || 0,
                isActive: isActive !== undefined ? isActive : true,
                createdByAdminId: req.admin?.userId
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
        const subCategory = await prisma.subCategory.update({
            where: { id },
            data: { 
                name, displayOrder, isActive,
                updatedByAdminId: req.admin?.userId
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
        await prisma.item.deleteMany({ where: { subCategoryId: id } });
        await prisma.subCategory.delete({ where: { id } });
        res.json({ message: 'Subcategory deleted' });
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
        const where = subCategoryId ? { subCategoryId } : {};
        const items = await prisma.item.findMany({
            where,
            include: { subCategory: { include: { category: true } } }
        });
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createItem = async (req, res) => {
    try {
        const { subCategoryId, name, skuCode, customerPrice, vendorShare, imageUrl, isActive } = req.body;
        const item = await prisma.item.create({
            data: { 
                subCategoryId, 
                name, 
                skuCode,
                customerPrice: parseFloat(customerPrice || 0), 
                vendorShare: parseFloat(vendorShare || 0),
                imageUrl,
                isActive: isActive !== undefined ? isActive : true,
                createdByAdminId: req.admin?.userId
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
        const { name, skuCode, customerPrice, vendorShare, imageUrl, subCategoryId, isActive } = req.body;
        const data = { updatedByAdminId: req.admin?.userId };
        
        if (name !== undefined) data.name = name;
        if (skuCode !== undefined) data.skuCode = skuCode;
        if (customerPrice !== undefined) data.customerPrice = parseFloat(customerPrice);
        if (vendorShare !== undefined) data.vendorShare = parseFloat(vendorShare);
        if (imageUrl !== undefined) data.imageUrl = imageUrl;
        if (subCategoryId !== undefined) data.subCategoryId = subCategoryId;
        if (isActive !== undefined) data.isActive = isActive;

        const item = await prisma.item.update({ where: { id }, data });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteItem = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.item.delete({ where: { id } });
        res.json({ message: 'Item deleted' });
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
                    customerPrice: parseFloat(itemData.customerPrice || 0),
                    vendorShare: parseFloat(itemData.vendorShare || 0),
                    createdByAdminId: req.admin?.userId
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
        const { updates } = req.body; // Array of { id, customerPrice, vendorShare }
        if (!Array.isArray(updates)) return res.status(400).json({ error: 'Updates array required' });

        const results = await Promise.all(
            updates.map(u => 
                prisma.item.update({
                    where: { id: u.id },
                    data: {
                        customerPrice: parseFloat(u.customerPrice),
                        vendorShare: parseFloat(u.vendorShare),
                        updatedByAdminId: req.admin?.userId
                    }
                })
            )
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
            const price = parseFloat(item.customerPrice || 0);
            const share = parseFloat(item.vendorShare || 0);
            return {
                customerPrice: price,
                vendorShare: share,
                platformCommission: price - share,
                marginPercent: price > 0 ? ((price - share) / price) * 100 : 0
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
