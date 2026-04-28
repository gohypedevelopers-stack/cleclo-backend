const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function isDateWindowActive({ effectiveFrom, effectiveTo }, now = new Date()) {
    return (!effectiveFrom || effectiveFrom <= now) && (!effectiveTo || effectiveTo >= now);
}

function getOverrideScore(override, cityCode, vendorId) {
    const priorityScore = (override.priority || 0) * 100;
    const vendorScore = vendorId && override.vendorId === vendorId ? 20 : 0;
    const cityScore = cityCode && override.cityCode === cityCode ? 10 : 0;
    return priorityScore + vendorScore + cityScore;
}

function selectBestOverride(overrides, cityCode, vendorId) {
    const now = new Date();
    return overrides
        .filter((override) => isDateWindowActive(override, now))
        .sort((a, b) => getOverrideScore(b, cityCode, vendorId) - getOverrideScore(a, cityCode, vendorId))[0];
}

async function resolvePricing({ items, cityCode = null, vendorId = null, serviceMultiplier = 1 }) {
    const itemRequests = Array.isArray(items) ? items : [];
    const itemIds = [...new Set(itemRequests.map((item) => item.itemId).filter(Boolean))];

    if (itemIds.length === 0) {
        return {
            lineItems: [],
            subtotalAmount: 0,
            gstAmount: 0,
            vendorShareAmount: 0,
            platformCommissionAmount: 0,
            totalAmount: 0
        };
    }

    const catalogItems = await prisma.item.findMany({
        where: {
            id: { in: itemIds },
            isActive: true
        },
        include: {
            subCategory: {
                include: {
                    category: {
                        include: {
                            service: true
                        }
                    }
                }
            },
            priceOverrides: {
                where: {
                    isActive: true,
                    OR: [
                        { cityCode: null, vendorId: null },
                        { cityCode, vendorId: null },
                        { cityCode: null, vendorId },
                        { cityCode, vendorId }
                    ]
                }
            }
        }
    });

    const itemById = new Map(catalogItems.map((item) => [item.id, item]));

    let subtotalAmount = 0;
    let gstAmount = 0;
    let vendorShareAmount = 0;
    let platformCommissionAmount = 0;

    const lineItems = itemRequests.map((request) => {
        const item = itemById.get(request.itemId);
        if (!item) {
            throw new Error(`Catalog item not found or inactive: ${request.itemId}`);
        }

        const quantity = Math.max(Number(request.quantity) || 0, 1);
        const override = selectBestOverride(item.priceOverrides || [], cityCode, vendorId);
        const unitPrice = override?.customerPrice ?? item.customerPrice;
        const unitVendorShare = override?.vendorShare ?? item.vendorShare;
        const gstPercent = override?.gstPercent ?? item.gstPercent ?? 0;
        const lineSubtotal = unitPrice * quantity * serviceMultiplier;
        const lineGstAmount = lineSubtotal * (gstPercent / 100);
        const lineTotal = lineSubtotal + lineGstAmount;
        const lineVendorShareAmount = unitVendorShare * quantity * serviceMultiplier;
        const linePlatformCommissionAmount = Math.max(lineSubtotal - lineVendorShareAmount, 0);

        subtotalAmount += lineSubtotal;
        gstAmount += lineGstAmount;
        vendorShareAmount += lineVendorShareAmount;
        platformCommissionAmount += linePlatformCommissionAmount;

        return {
            itemId: item.id,
            itemName: item.name,
            quantity,
            unitPrice,
            lineSubtotal,
            lineTotal,
            gstPercent,
            gstAmount: lineGstAmount,
            vendorShare: unitVendorShare,
            vendorShareAmount: lineVendorShareAmount,
            platformCommissionAmount: linePlatformCommissionAmount,
            isOverridden: Boolean(override),
            overrideId: override?.id || null,
            serviceId: item.subCategory?.category?.service?.id || null,
            serviceName: item.subCategory?.category?.service?.name || null
        };
    });

    return {
        lineItems,
        subtotalAmount,
        gstAmount,
        vendorShareAmount,
        platformCommissionAmount,
        totalAmount: subtotalAmount + gstAmount
    };
}

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

        const pricing = await resolvePricing({
            items: itemIds.map((itemId) => ({ itemId, quantity: 1 })),
            cityCode,
            vendorId
        });

        const resolvedItems = pricing.lineItems.map((lineItem) => ({
            id: lineItem.itemId,
            name: lineItem.itemName,
            customerPrice: lineItem.unitPrice,
            vendorShare: lineItem.vendorShare,
            gstPercent: lineItem.gstPercent,
            isOverridden: lineItem.isOverridden,
            overrideId: lineItem.overrideId
        }));

        res.json(resolvedItems);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const resolveCatalogPricing = async (req, res) => {
    try {
        const { items, cityCode, vendorId, serviceMultiplier } = req.body;

        if (!Array.isArray(items)) {
            return res.status(400).json({ message: 'items must be an array' });
        }

        const pricing = await resolvePricing({
            items,
            cityCode,
            vendorId,
            serviceMultiplier: Number(serviceMultiplier) || 1
        });

        res.json(pricing);
    } catch (error) {
        res.status(400).json({ error: error.message });
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
    resolveCatalogPricing,
    createService,
    createCategory,
    createItem
};
