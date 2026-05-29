const prisma = require('../utils/prisma');
const { fetchUsersByIds, searchUsers } = require('../utils/authServiceClient');

const buildMaintenanceAssignmentBlock = (vendor) => ({
    error: 'Vendor Under Maintenance',
    message: 'This outlet is under maintenance and cannot receive new orders.',
    code: 'VENDOR_MAINTENANCE',
    vendorId: vendor.id,
    vendorName: vendor.vendorProfile?.businessName || vendor.name,
    reopenDate: vendor.vendorProfile?.reopenDate || null,
    existingOrderProcessingAllowed: true
});

// Helper to enrich orders with user and vendor data
const enrichOrdersData = async (orders) => {
    if (!orders.length) return [];

    const userIds = [...new Set(orders.map(o => o.userId).filter(Boolean))];
    const vendorIds = [...new Set(orders.map(o => o.vendorId).filter(Boolean))];
    const riderIds = [...new Set(orders.map(o => o.riderId).filter(Boolean))];

    const allUserIds = [...new Set([...userIds, ...vendorIds, ...riderIds])];
    const users = await fetchUsersByIds(allUserIds);
    const userMap = new Map(users.map(u => [u.id, u]));

    return orders.map(order => ({
        ...order,
        deliveryType: order.serviceType,
        user: userMap.get(order.userId),
        vendor: userMap.get(order.vendorId),
        rider: userMap.get(order.riderId)
    }));
};

// Get all orders (with filters including search and pagination)
const getAllOrders = async (req, res) => {
    try {
        const { status, vendorId, userId, date, hasIssue, search, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const where = {};
        
        if (status && status !== 'all') where.status = status;
        if (vendorId && vendorId !== 'all') where.vendorId = vendorId;
        if (userId && userId !== 'all') where.userId = userId;
        if (hasIssue === 'true') where.hasIssue = true;
        
        if (date) {
            const startDate = new Date(date);
            if (isNaN(startDate.getTime())) {
                return res.status(400).json({ error: 'Invalid date format' });
            }
            startDate.setHours(0, 0, 0, 0);
            const endDate = new Date(date);
            endDate.setHours(23, 59, 59, 999);
            where.createdAt = { gte: startDate, lte: endDate };
        }

        if (search) {
            const searchConditions = [
                { id: { contains: search, mode: 'insensitive' } },
                { cityCode: { contains: search, mode: 'insensitive' } },
                { areaName: { contains: search, mode: 'insensitive' } }
            ];


            const matchingUsers = await searchUsers(search);
            if (matchingUsers.length > 0) {
                const matchingUserIds = matchingUsers.map(u => u.id);
                searchConditions.push({ userId: { in: matchingUserIds } });
                searchConditions.push({ vendorId: { in: matchingUserIds } });
                searchConditions.push({ riderId: { in: matchingUserIds } });
            } else if (search.length > 5) {
                searchConditions.push({ userId: { contains: search, mode: 'insensitive' } });
            }

            where.OR = searchConditions;
        }

        const [orders, total] = await Promise.all([
            prisma.order.findMany({
                where,
                include: {
                    items: {
                        include: { images: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take
            }),
            prisma.order.count({ where })
        ]);

        const enrichedOrders = await enrichOrdersData(orders);

        // Auto-flag unassigned Express orders > 15 mins
        const now = Date.now();
        const ordersToFlag = [];
        enrichedOrders.forEach(o => {
            const isExpress = (o.deliveryType || '').toLowerCase().includes('express');
            const isUnassigned = !o.riderId && !['delivered', 'cancelled', 'picked_up', 'received_by_vendor', 'ready_for_delivery', 'out_for_delivery'].includes(o.status?.toLowerCase());
            if (isExpress && isUnassigned && !o.hasIssue && o.createdAt) {
                const elapsedMins = (now - new Date(o.createdAt).getTime()) / 60000;
                if (elapsedMins >= 15) {
                    ordersToFlag.push(o.id);
                    o.hasIssue = true;
                    o.issueType = 'Auto-Flag: Dispatch Delay';
                    o.issueNote = `Express order unassigned for >${Math.floor(elapsedMins)} mins`;
                }
            }
        });

        if (ordersToFlag.length > 0) {
            // Fire and forget DB update
            prisma.order.updateMany({
                where: { id: { in: ordersToFlag } },
                data: {
                    hasIssue: true,
                    issueType: 'Auto-Flag: Dispatch Delay',
                    issueNote: 'Express order unassigned for >15 mins'
                }
            }).catch(err => console.error('Auto-flag error:', err));
        }

        res.json({
            orders: enrichedOrders,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error in getAllOrders:', error);
        res.status(500).json({ error: 'Failed to fetch orders', details: error.message });
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

        const enriched = await enrichOrdersData([order]);
        res.json(enriched[0]);
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

        if (!vendorId) return res.status(400).json({ error: 'Vendor ID is required' });

        const vendors = await fetchUsersByIds([vendorId]);
        const vendor = vendors[0];

        if (!vendor || vendor.role !== 'vendor') {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        if (vendor.vendorProfile?.isMaintenance) {
            return res.status(409).json(buildMaintenanceAssignmentBlock(vendor));
        }

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

        if (!riderId) return res.status(400).json({ error: 'Rider ID is required' });

        // Check rider capacity from Auth Service
        const riders = await fetchUsersByIds([riderId]);
        const rider = riders[0];

        if (!rider) return res.status(404).json({ error: 'Rider not found' });
        if (rider.role !== 'rider') return res.status(400).json({ error: 'User is not a rider' });

        const rp = rider.riderProfile || {};
        // If overloaded, avoid assigning (Dispatch system safeguard)
        if (rp.activeOrders >= (rp.maxCapacity || 8)) {
            return res.status(400).json({ 
                error: 'Rider Overloaded', 
                message: `Rider has reached maximum capacity (${rp.maxCapacity || 8} orders). Please assign to another rider.`
            });
        }

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

// Get orders with issues (and recently resolved for dashboard context)
const getOrdersWithIssues = async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const orders = await prisma.order.findMany({
            where: {
                OR: [
                    { hasIssue: true },
                    { 
                        status: { in: ['resolved', 'delivered', 'cancelled'] },
                        updatedAt: { gte: todayStart }
                    }
                ]
            },
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

// Analytics charts data
const getAnalyticsData = async (req, res) => {
    try {
        const now = new Date();

        // ── Monthly Revenue & Orders (last 12 months) ──────────────────────
        const months = [];
        for (let i = 11; i >= 0; i--) {
            const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
            const label = start.toLocaleString('en-IN', { month: 'short' });
            const [agg, count] = await Promise.all([
                prisma.order.aggregate({ where: { createdAt: { gte: start, lt: end }, paymentStatus: 'paid' }, _sum: { totalAmount: true } }),
                prisma.order.count({ where: { createdAt: { gte: start, lt: end } } })
            ]);
            months.push({ name: label, revenue: Math.round(agg._sum.totalAmount || 0), orders: count });
        }

        // ── Service Distribution ────────────────────────────────────────────
        const serviceGroups = await prisma.order.groupBy({ by: ['serviceType'], _count: { id: true } });
        const totalOrders = serviceGroups.reduce((s, g) => s + g._count.id, 0);
        const SERVICE_COLORS = { 'Standard': '#3E8940', 'Express 48h': '#22c55e', 'Express 24h': '#86efac' };
        const serviceData = serviceGroups.map(g => ({ name: g.serviceType || 'Other', value: g._count.id, color: SERVICE_COLORS[g.serviceType] || '#14532d' }));

        // ── Customer Growth (4 weeks) ───────────────────────────────────────
        const weekGrowth = [];
        for (let w = 3; w >= 0; w--) {
            const dow = now.getDay() === 0 ? 7 : now.getDay();
            const monday = new Date(now); monday.setDate(now.getDate() - (dow - 1) - w * 7); monday.setHours(0,0,0,0);
            const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6); sunday.setHours(23,59,59,999);
            const weekOrders = await prisma.order.findMany({ where: { createdAt: { gte: monday, lte: sunday } }, select: { userId: true } });
            const total = new Set(weekOrders.map(o => o.userId)).size;
            weekGrowth.push({ name: `Week ${4 - w}`, new: Math.max(1, Math.round(total * 0.28)), returning: Math.max(0, Math.round(total * 0.72)) });
        }

        res.json({ revenueData: months, serviceData, customerGrowthData: weekGrowth, totalOrders, generatedAt: new Date().toISOString() });
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
    getDashboardStats,
    getAnalyticsData
};
