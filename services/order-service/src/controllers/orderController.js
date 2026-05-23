const prisma = require('../utils/prisma');
const { calculateDeliveryDate, getPriceMultiplier } = require('../utils/pricing');
const { resolveCatalogPricing, validateLocationAndSlot } = require('../utils/catalogServiceClient');
const { fetchUsersByIds } = require('../utils/authServiceClient');

const buildMaintenanceOrderBlock = (vendor) => ({
    message: 'Vendor outlet is under maintenance and cannot accept new orders',
    code: 'VENDOR_MAINTENANCE',
    vendorId: vendor.id,
    vendorName: vendor.vendorProfile?.businessName || vendor.name,
    reopenDate: vendor.vendorProfile?.reopenDate || null,
    existingOrderProcessingAllowed: true
});

const ensureVendorCanAcceptNewOrder = async (vendorId) => {
    if (!vendorId) return { allowed: true };

    const vendors = await fetchUsersByIds([vendorId]);
    const vendor = vendors[0];

    if (!vendor || vendor.role !== 'vendor') {
        return {
            allowed: false,
            status: 404,
            payload: { message: 'Vendor not found', code: 'VENDOR_NOT_FOUND', vendorId }
        };
    }

    if (vendor.vendorProfile?.isMaintenance) {
        return {
            allowed: false,
            status: 409,
            payload: buildMaintenanceOrderBlock(vendor)
        };
    }

    return { allowed: true, vendor };
};

const createOrder = async (req, res) => {
    try {
        const { 
            userId, 
            items, 
            pickupTime, 
            serviceType, 
            gstNumber, 
            pickupAddress, 
            deliveryAddress, 
            cityCode, 
            vendorId,
            areaCode,
            areaName,
            slotId
        } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'At least one order item is required' });
        }

        const vendorAvailability = await ensureVendorCanAcceptNewOrder(vendorId);
        if (!vendorAvailability.allowed) {
            return res.status(vendorAvailability.status).json(vendorAvailability.payload);
        }

        const validation = await validateLocationAndSlot({ cityCode, areaCode, areaName, pickupTime, slotId });
        
        if (!validation.valid) {
            return res.status(400).json({ message: validation.message || 'Invalid location or time slot' });
        }

        const serviceMultiplier = getPriceMultiplier(serviceType);
        const pricing = await resolveCatalogPricing({
            items: items.map((item) => ({
                itemId: item.itemId,
                quantity: item.quantity
            })),
            cityCode,
            vendorId,
            serviceMultiplier
        });

        const locationSurcharge = pricing.subtotalAmount * ((validation.surgePercent || 0) / 100);
        const authoritativeTotalAmount = pricing.totalAmount + locationSurcharge;

        const validItemsForDb = pricing.lineItems.map((lineItem, index) => {
            const requestItem = items[index] || {};
            return {
                itemId: lineItem.itemId,
                itemName: lineItem.itemName,
                quantity: lineItem.quantity,
                unitPrice: lineItem.unitPrice,
                lineSubtotal: lineItem.lineSubtotal,
                lineTotal: lineItem.lineTotal,
                gstPercent: lineItem.gstPercent,
                gstAmount: lineItem.gstAmount,
                vendorShare: lineItem.vendorShare,
                vendorShareAmount: lineItem.vendorShareAmount,
                platformCommissionAmount: lineItem.platformCommissionAmount,
                pricingSnapshot: lineItem,
                condition: requestItem.condition,
                images: {
                    create: requestItem.images ? requestItem.images.map(img => ({ imageUrl: img })) : []
                }
            };
        });

        const deliveryTime = calculateDeliveryDate(new Date(pickupTime), serviceType);

        const order = await prisma.order.create({
            data: {
                userId,
                vendorId,
                pickupTime: new Date(pickupTime),
                deliveryTime,
                pickupAddress,
                deliveryAddress,
                serviceType,
                totalAmount: authoritativeTotalAmount,
                subtotalAmount: pricing.subtotalAmount,
                gstAmount: pricing.gstAmount,
                vendorShareAmount: pricing.vendorShareAmount,
                platformCommissionAmount: pricing.platformCommissionAmount,
                locationSurcharge,
                gstNumber,
                cityCode,
                areaCode: validation.areaCode || areaCode || null,
                areaName: validation.areaName || areaName || null,
                slotId,
                pricingSnapshot: {
                    pricing,
                    location: validation,
                    serviceMultiplier
                },
                items: {
                    create: validItemsForDb
                }
            },
            include: {
                items: {
                    include: {
                        images: true
                    }
                }
            }
        });

        res.status(201).json(order);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

const checkPrice = async (req, res) => {
    try {
        const { pickupTime, serviceType } = req.body;
        const deliveryDate = calculateDeliveryDate(new Date(pickupTime), serviceType);
        const multiplier = getPriceMultiplier(serviceType);
        res.json({ deliveryDate, multiplier });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const uploadImage = (req, res) => {
    if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
    }
    // Return URL relative to service (Gateway will need to proxy or we return full URL if we knew host)
    // Assuming Gateway proxies /api/orders/uploads to this service /uploads
    const imageUrl = `/uploads/${req.file.filename}`;
    res.json({ imageUrl });
};

// Get all orders for a specific customer
const getCustomerOrders = async (req, res) => {
    try {
        const { userId } = req.params;
        const orders = await prisma.order.findMany({
            where: { userId },
            include: {
                items: {
                    include: {
                        images: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

// Get single order by ID
const getOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                items: {
                    include: {
                        images: true
                    }
                }
            }
        });
        
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }
        
        res.json(order);
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

// Update order status (for cancellation, etc.)
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const order = await prisma.order.update({
            where: { id },
            data: { status },
            include: {
                items: {
                    include: {
                        images: true
                    }
                }
            }
        });
        
        res.json(order);
    } catch (error) {
        console.error(error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: 'Order not found' });
        }
        res.status(500).json({ message: 'Internal Server Error', error: error.message });
    }
};

module.exports = {
    createOrder,
    checkPrice,
    uploadImage,
    getCustomerOrders,
    getOrder,
    updateOrderStatus
};
