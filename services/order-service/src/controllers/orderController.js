const { PrismaClient } = require('@prisma/client');
const { calculateDeliveryDate, getPriceMultiplier } = require('../utils/pricing');

const prisma = new PrismaClient();

const createOrder = async (req, res) => {
    try {
        const { userId, items, pickupTime, serviceType, gstNumber, pickupAddress, deliveryAddress } = req.body;
        // items: [{ itemId, quantity, condition, images: [url1, url2] }]

        // Simple calculation logic (omitted complex item lookup for speed, assuming client sends totals or we'd need Catalog Service calls)
        // For MVP, assuming client sends valid totals or we trust the basePrice if we had it.
        // Let's assume the client sends expected totalAmount for now, or we'd fetch prices from Catalog Service.
        // Since we don't have direct DB access to Catalog here, strict microservices would require HTTP call.
        // I will implement a rudimentary calculation or trust valid input for this step to save time on inter-service comms implementation.

        // Better: Receive totalAmount from client computed from Catalog. verify later.
        const totalAmount = req.body.totalAmount || 100; // Placeholder

        const deliveryTime = calculateDeliveryDate(new Date(pickupTime), serviceType);

        const order = await prisma.order.create({
            data: {
                userId,
                pickupTime: new Date(pickupTime),
                deliveryTime,
                pickupAddress,
                deliveryAddress,
                serviceType,
                totalAmount,
                gstNumber,
                items: {
                    create: items.map(item => ({
                        itemId: item.itemId,
                        quantity: item.quantity,
                        condition: item.condition, // Capture condition (damage/stain)
                        images: {
                            create: item.images.map(img => ({ imageUrl: img }))
                        }
                    }))
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
