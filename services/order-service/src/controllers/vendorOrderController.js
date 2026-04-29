const prisma = require('../utils/prisma');

// Get orders for a specific vendor
const getVendorOrders = async (req, res) => {
    try {
        const { vendorId, status, date } = req.query;

        if (!vendorId) {
            return res.status(400).json({ error: 'vendorId is required' });
        }

        const where = { vendorId };
        if (status) where.status = status;
        if (date) {
            const start = new Date(date);
            const end = new Date(date);
            end.setDate(end.getDate() + 1);
            where.createdAt = { gte: start, lt: end };
        }

        const orders = await prisma.order.findMany({
            where,
            include: {
                items: {
                    include: { images: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update order progress (vendor updates status)
const updateOrderProgress = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // e.g., 'processing', 'out_for_delivery'

        const order = await prisma.order.update({
            where: { id },
            data: { status }
        });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Vendor dashboard stats
const getVendorStats = async (req, res) => {
    try {
        const { vendorId } = req.query;

        if (!vendorId) {
            return res.status(400).json({ error: 'vendorId is required' });
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [
            totalOrders,
            todayOrders,
            pendingOrders,
            processingOrders,
            completedOrders,
            revenueResult
        ] = await Promise.all([
            prisma.order.count({ where: { vendorId } }),
            prisma.order.count({ where: { vendorId, createdAt: { gte: today, lt: tomorrow } } }),
            prisma.order.count({ where: { vendorId, status: 'pending' } }),
            prisma.order.count({ where: { vendorId, status: 'processing' } }),
            prisma.order.count({ where: { vendorId, status: 'delivered' } }),
            prisma.order.aggregate({
                where: { vendorId, paymentStatus: 'paid' },
                _sum: { totalAmount: true }
            })
        ]);

        // Calculate completion rate
        const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

        res.json({
            totalOrders,
            todayOrders,
            pendingOrders,
            processingOrders,
            completedOrders,
            completionRate,
            earnings: revenueResult._sum.totalAmount || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Accept order (vendor accepts assigned order)
const acceptOrder = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await prisma.order.update({
            where: { id },
            data: { status: 'picked_up' }
        });
        res.json({ message: 'Order accepted', order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Mark order as ready for delivery
const markReadyForDelivery = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await prisma.order.update({
            where: { id },
            data: { status: 'out_for_delivery' }
        });
        res.json({ message: 'Order marked ready for delivery', order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getVendorOrders,
    updateOrderProgress,
    getVendorStats,
    acceptOrder,
    markReadyForDelivery
};
