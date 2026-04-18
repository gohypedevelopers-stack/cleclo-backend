const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get all orders (with filters including vendorId)
const getAllOrders = async (req, res) => {
    try {
        const { status, vendorId, userId, date, hasIssue } = req.query;
        const where = {};

        if (status) where.status = status;
        if (vendorId) where.vendorId = vendorId;
        if (userId) where.userId = userId;
        if (hasIssue === 'true') where.hasIssue = true;

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

// Get single order by ID
const getOrderById = async (req, res) => {
    try {
        const { id } = req.params;
        const order = await prisma.order.findUnique({
            where: { id },
            include: {
                items: {
                    include: { images: true }
                }
            }
        });
        if (!order) return res.status(404).json({ error: "Order not found" });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update Order Status
const updateOrderStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const order = await prisma.order.update({
            where: { id },
            data: { status }
        });
        res.json(order);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Assign vendor to order
const assignVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { vendorId } = req.body;

        const order = await prisma.order.update({
            where: { id },
            data: { vendorId, status: 'pickup_assigned' }
        });
        res.json({ message: 'Vendor assigned', order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Assign rider to order
const assignRider = async (req, res) => {
    try {
        const { id } = req.params;
        const { riderId } = req.body;

        const order = await prisma.order.update({
            where: { id },
            data: { riderId }
        });
        res.json({ message: 'Rider assigned', order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Report issue on order
const reportIssue = async (req, res) => {
    try {
        const { id } = req.params;
        const { issueType, issueNote } = req.body;

        const order = await prisma.order.update({
            where: { id },
            data: {
                hasIssue: true,
                issueType,
                issueNote
            }
        });
        res.json({ message: 'Issue reported', order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Resolve issue
const resolveIssue = async (req, res) => {
    try {
        const { id } = req.params;

        const order = await prisma.order.update({
            where: { id },
            data: {
                hasIssue: false,
                issueType: null,
                issueNote: null
            }
        });
        res.json({ message: 'Issue resolved', order });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get orders with issues
const getOrdersWithIssues = async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            where: { hasIssue: true },
            include: {
                items: true
            },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(orders);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get dashboard stats
const getDashboardStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [
            totalOrders,
            todayOrders,
            pendingOrders,
            processingOrders,
            deliveredOrders,
            issueOrders,
            revenueResult
        ] = await Promise.all([
            prisma.order.count(),
            prisma.order.count({ where: { createdAt: { gte: today, lt: tomorrow } } }),
            prisma.order.count({ where: { status: 'pending' } }),
            prisma.order.count({ where: { status: 'processing' } }),
            prisma.order.count({ where: { status: 'delivered' } }),
            prisma.order.count({ where: { hasIssue: true } }),
            prisma.order.aggregate({
                where: { paymentStatus: 'paid' },
                _sum: { totalAmount: true }
            })
        ]);

        res.json({
            totalOrders,
            todayOrders,
            pendingOrders,
            processingOrders,
            deliveredOrders,
            issueOrders,
            revenue: revenueResult._sum.totalAmount || 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllOrders,
    getOrderById,
    updateOrderStatus,
    assignVendor,
    assignRider,
    reportIssue,
    resolveIssue,
    getOrdersWithIssues,
    getDashboardStats
};
