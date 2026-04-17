const { PrismaClient } = require('@prisma/client');
const { calculateDeliveryDate, getPriceMultiplier } = require('../utils/pricing');
const { fetchItemPrices } = require('../utils/catalogServiceClient');

const prisma = new PrismaClient();

const createOrder = async (req, res) => {
    try {
        const { userId, items, pickupTime, serviceType, gstNumber, pickupAddress, deliveryAddress } = req.body;
        // items: [{ itemId, quantity, condition, images: [url1, url2] }]

        // Fetch authoritative pricing from Catalog Service
        const itemIds = items.map(i => i.itemId);
        const pricingMap = await fetchItemPrices(itemIds);

        const serviceMultiplier = getPriceMultiplier(serviceType);

        let authoritativeTotalAmount = 0;
        const validItemsForDb = items.map(item => {
            const basePrice = pricingMap[item.itemId] || 0;
            const itemTotal = basePrice * item.quantity * serviceMultiplier;
            authoritativeTotalAmount += itemTotal;

            return {
                itemId: item.itemId,
                quantity: item.quantity,
                condition: item.condition,
                images: {
                    create: item.images ? item.images.map(img => ({ imageUrl: img })) : []
                }
            };
        });

        const deliveryTime = calculateDeliveryDate(new Date(pickupTime), serviceType);

        const order = await prisma.order.create({
            data: {
                userId,
                pickupTime: new Date(pickupTime),
                deliveryTime,
                pickupAddress,
                deliveryAddress,
                serviceType,
                totalAmount: authoritativeTotalAmount,
                gstNumber,
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
