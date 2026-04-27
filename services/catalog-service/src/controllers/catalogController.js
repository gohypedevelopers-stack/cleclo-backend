const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getServices = async (req, res) => {
    try {
        const services = await prisma.service.findMany({
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
            include: {
                categories: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                    include: {
                        subCategories: {
                            where: { isActive: true },
                            orderBy: { displayOrder: 'asc' },
                            include: {
                                items: {
                                    where: { isActive: true }
                                }
                            }
                        }
                    }
                }
            }
        });
        res.json(services);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getInputData = async (req, res) => {
    try {
        // Optimized hierarchical fetch
        const services = await prisma.service.findMany({
            where: { isActive: true },
            orderBy: { displayOrder: 'asc' },
            include: {
                categories: {
                    where: { isActive: true },
                    orderBy: { displayOrder: 'asc' },
                    include: {
                        subCategories: {
                            where: { isActive: true },
                            orderBy: { displayOrder: 'asc' },
                            include: {
                                items: {
                                    where: { isActive: true }
                                }
                            }
                        }
                    }
                }
            }
        });
        res.json(services);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error' });
    }
};

const getItemsByIds = async (req, res) => {
    try {
        const { itemIds, cityCode, vendorId } = req.body;
        if (!Array.isArray(itemIds)) {
            return res.status(400).json({ message: 'itemIds must be an array' });
        }
        
        const items = await prisma.item.findMany({
            where: { id: { in: itemIds } },
            include: {
                priceOverrides: {
                    where: {
                        isActive: true,
                        OR: [
                            { cityCode: cityCode || null },
                            { vendorId: vendorId || null }
                        ]
                    },
                    orderBy: { priority: 'desc' }
                }
            }
        });

        // Resolve price for each item
        const resolvedItems = items.map(item => {
            const override = item.priceOverrides[0]; // Highest priority because of orderBy
            if (override) {
                return {
                    ...item,
                    customerPrice: override.customerPrice,
                    vendorShare: override.vendorShare,
                    gstPercent: override.gstPercent,
                    isOverridden: true
                };
            }
            return { ...item, isOverridden: false };
        });

        res.json(resolvedItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createService = async (req, res) => {
    try {
        const { name, slug } = req.body;
        const service = await prisma.service.create({ data: { name, slug: slug || name.toLowerCase().replace(/\s+/g, '-') } });
        res.json(service);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createCategory = async (req, res) => {
    try {
        const { serviceId, name, displayOrder } = req.body;
        const category = await prisma.category.create({ data: { serviceId, name, displayOrder: displayOrder || 0 } });
        res.json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createItem = async (req, res) => {
    try {
        const { subCategoryId, name, customerPrice, imageUrl } = req.body;
        const item = await prisma.item.create({ data: { subCategoryId, name, customerPrice, imageUrl } });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getServices,
    getInputData,
    getItemsByIds,
    createService,
    createCategory,
    createItem
};
