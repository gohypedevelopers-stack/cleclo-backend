const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeSettlementStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'processing') return 'processing';
    if (normalized === 'paid') return 'paid';
    if (normalized === 'failed') return 'failed';
    return 'pending';
}

// Get vendor dashboard stats
const getDashboardStats = async (req, res) => {
    try {
        const { vendorId } = req.query; // Should come from auth middleware in production

        if (!vendorId) {
            return res.status(400).json({ error: 'vendorId is required' });
        }

        // Get vendor profile
        const vendor = await prisma.user.findUnique({
            where: { id: vendorId },
            include: { vendorProfile: true, outlets: true }
        });

        if (!vendor || vendor.role !== 'vendor') {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        // Get pending settlements total
        const pendingEarnings = await prisma.vendorSettlement.aggregate({
            where: { vendorId, status: 'PENDING' },
            _sum: { amount: true }
        });

        // Get paid settlements total
        const totalEarnings = await prisma.vendorSettlement.aggregate({
            where: { vendorId, status: 'PAID' },
            _sum: { amount: true }
        });

        res.json({
            businessName: vendor.vendorProfile?.businessName || vendor.name,
            isApproved: vendor.vendorProfile?.isApproved || false,
            servicesOffered: vendor.vendorProfile?.servicesOffered || '',
            dailyCapacity: vendor.vendorProfile?.dailyCapacity || 0,
            outlets: vendor.outlets,
            pendingEarnings: pendingEarnings._sum.amount || 0,
            totalEarnings: totalEarnings._sum.amount || 0,
            // Order stats would need to come from order-service
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get vendor earnings history
const getEarnings = async (req, res) => {
    try {
        const { vendorId } = req.query;
        const { startDate, endDate, status } = req.query;

        if (!vendorId) {
            return res.status(400).json({ error: 'vendorId is required' });
        }

        const where = { vendorId };
        if (status) where.status = String(status).trim().toUpperCase();
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = new Date(startDate);
            if (endDate) where.createdAt.lte = new Date(endDate);
        }

        const earnings = await prisma.vendorSettlement.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        // Calculate totals
        const totals = await prisma.vendorSettlement.groupBy({
            by: ['status'],
            where: { vendorId },
            _sum: { amount: true },
            _count: true
        });

        res.json({
            earnings: earnings.map((earning) => ({
                ...earning,
                status: normalizeSettlementStatus(earning.status)
            })),
            summary: totals.reduce((acc, t) => {
                acc[normalizeSettlementStatus(t.status)] = { amount: t._sum.amount, count: t._count };
                return acc;
            }, {})
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get/Update vendor schedule (stored in operatingHours for now)
const getSchedule = async (req, res) => {
    try {
        const { vendorId } = req.query;

        if (!vendorId) {
            return res.status(400).json({ error: 'vendorId is required' });
        }

        const outlets = await prisma.outlet.findMany({
            where: { vendorId }
        });

        res.json(outlets.map(o => ({
            outletId: o.id,
            name: o.name,
            operatingHours: o.operatingHours
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateSchedule = async (req, res) => {
    try {
        const { outletId, operatingHours } = req.body;

        const outlet = await prisma.outlet.update({
            where: { id: outletId },
            data: { operatingHours }
        });

        res.json({ message: 'Schedule updated', outlet });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update services offered
const updateServices = async (req, res) => {
    try {
        const { vendorId, servicesOffered } = req.body;

        const profile = await prisma.vendorProfile.update({
            where: { userId: vendorId },
            data: { servicesOffered }
        });

        res.json({ message: 'Services updated', profile });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update daily capacity
const updateCapacity = async (req, res) => {
    try {
        const { vendorId, dailyCapacity } = req.body;

        const profile = await prisma.vendorProfile.update({
            where: { userId: vendorId },
            data: { dailyCapacity: parseInt(dailyCapacity) }
        });

        res.json({ message: 'Capacity updated', profile });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getDashboardStats,
    getEarnings,
    getSchedule,
    updateSchedule,
    updateServices,
    updateCapacity
};
