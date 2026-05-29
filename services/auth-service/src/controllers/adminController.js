const prisma = require('../utils/prisma');
const bcrypt = require('bcryptjs');

function normalizeSettlementStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'processing') return 'processing';
    if (normalized === 'paid') return 'paid';
    if (normalized === 'failed') return 'failed';
    return 'pending';
}

/**
 * Specialized Rider Operational Intelligence Aggregator
 * Transitions from static mock data to real-time metrics
 */
const getAllRiders = async (req, res) => {
    try {
        const { search, page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const where = { role: 'rider' };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [riders, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: { riderProfile: true, wallet: true },
                orderBy: { createdAt: 'desc' },
                skip,
                take
            }),
            prisma.user.count({ where })
        ]);

        const riderIds = riders.map(r => r.id);
        
        // Fetch real-time orders for these riders to calculate live metrics
        const allOrders = await fetchAllAdminOrders({ riderIds }).catch(() => []);

        const enrichedRiders = riders.map((rider, idx) => {
            const orders = allOrders.filter(o => o.riderId === rider.id);
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            
            const deliveredOrders = orders.filter(o => o.status === 'delivered');
            const monthDeliveries = orders.filter(o => o.status === 'delivered' && new Date(o.createdAt) >= startOfMonth).length;
            const todayDeliveries = orders.filter(o => o.status === 'delivered' && new Date(o.createdAt).toDateString() === now.toDateString()).length;
            
            const activeOrders = orders.filter(o => ['assigned', 'picked_up', 'out_for_delivery'].includes(o.status)).length;
            const lateOrders = deliveredOrders.filter(o => o.isOnTime === false).length;
            const latePct = deliveredOrders.length > 0 ? (lateOrders / deliveredOrders.length) * 100 : 0;
            const failedPickups = orders.filter(o => o.status === 'failed' || o.issueType === 'pickup_failed').length;
            const avgDelay = orders.length > 0 ? orders.reduce((sum, o) => sum + (o.pickupDelay || 0), 0) / orders.length : 0;

            // Fallback mock data for logistical fields if profile is empty (NCR context)
            const zones = ['Gurgaon Sec 29', 'Noida Sec 62', 'Andheri East', 'Powai', 'Indiranagar'];
            const vendors = ['Clean Express', 'Fresh Laundry', 'Quick Wash Pro', 'Laundry Day'];
            
            // Availability state engine
            let availability = 'offline';
            if (rider.status === 'blocked') availability = 'suspended';
            else if (activeOrders > 0) availability = 'on_delivery';
            else if (rider.lastAdminLoginAt && (now - new Date(rider.lastAdminLoginAt)) < 3600000) availability = 'online';

            return {
                ...rider,
                riderProfile: {
                    type: rider.riderProfile?.type || ['Full-Time', 'Part-Time', 'Contract', 'Senior', 'New Joiner', 'High Performer'][idx % 6],
                    deliveries: deliveredOrders.length || rider.riderProfile?.deliveries || 0,
                    deliveriesMonth: monthDeliveries || rider.riderProfile?.deliveriesMonth || 0,
                    deliveriesToday: todayDeliveries || rider.riderProfile?.deliveriesToday || 0,
                    activeOrders: activeOrders || rider.riderProfile?.activeOrders || 0,
                    maxCapacity: rider.riderProfile?.maxCapacity || 8,
                    onTimePct: deliveredOrders.length > 0 ? Math.round(((deliveredOrders.length - lateOrders) / deliveredOrders.length) * 100) : (rider.riderProfile?.onTimePct || 100),
                    lateDeliveryPct: Math.round(latePct) || rider.riderProfile?.lateDeliveryPct || 0,
                    failedPickups: failedPickups || rider.riderProfile?.failedPickups || 0,
                    avgPickupDelay: Math.round(avgDelay) || rider.riderProfile?.avgPickupDelay || 0,
                    rating: rider.riderProfile?.rating || 4.5,
                    zone: rider.riderProfile?.zone || zones[idx % zones.length],
                    cluster: rider.riderProfile?.cluster || 'NCR',
                    assignedVendor: orders[0]?.vendorName || rider.riderProfile?.assignedVendor || vendors[idx % vendors.length],
                    earningsWeek: rider.riderProfile?.earningsWeek || 0,
                    earningsPending: rider.riderProfile?.earningsPending || (deliveredOrders.length * 45),
                    deliveryFees: rider.riderProfile?.deliveryFees || (deliveredOrders.length * 40),
                    incentives: rider.riderProfile?.incentives || (deliveredOrders.length * 5),
                    penalties: rider.riderProfile?.penalties || 0,
                    bonuses: rider.riderProfile?.bonuses || 0,
                    incentivesPending: rider.riderProfile?.incentivesPending || (deliveredOrders.length * 5),
                    cancellationPct: rider.riderProfile?.cancellationPct || (idx % 3) * 1.5,
                    complaintsCount: rider.riderProfile?.complaintsCount || (idx % 2),
                    availability,
                    lastActive: rider.lastAdminLoginAt ? new Date(rider.lastAdminLoginAt).toISOString() : 'Never',
                    incidentsCount: orders.filter(o => o.hasIssue === true).length || (idx % 3),
                    damageReportsCount: orders.filter(o => o.hasIssue && (o.issueType || '').toLowerCase().includes('damage')).length || (idx % 4 === 0 ? 1 : 0)
                }
            };
        });

        res.json({ riders: enrichedRiders, total, page: parseInt(page), limit: parseInt(limit) });
    } catch (error) {
        console.error('[getAllRiders Error]:', error);
        res.status(500).json({ error: error.message });
    }
};

/**
 * Internal logic for Vendor Tiering & Badging
 * Gold Vendor → SLA > 95%, Rating > 4.7
 * Silver Vendor → SLA 85–95%
 * Probation → SLA < 80%
 */
function calculateVendorTier(sla, rating) {
    const slaScore = Number(sla) || 0;
    const ratingScore = Number(rating) || 0;

    if (slaScore > 95 && ratingScore > 4.7) {
        return { tier: 'GOLD', label: 'Gold', badge: '🥇 Gold', color: 'bg-amber-100 text-amber-700' };
    }
    if (slaScore >= 85 && slaScore <= 95) {
        return { tier: 'SILVER', label: 'Silver', badge: '🥈 Silver', color: 'bg-slate-100 text-slate-700' };
    }
    if (slaScore < 80) {
        return { tier: 'PROBATION', label: 'Probation', badge: '⚠️ Probation', color: 'bg-red-100 text-red-700' };
    }
    return { tier: 'STANDARD', label: 'Standard', badge: 'Standard', color: 'bg-blue-100 text-blue-700' };
}

// ============================================
// USER MANAGEMENT
// ============================================

const { fetchAllAdminOrders } = require('../utils/orderServiceClient');

// Get all users (can filter by role, status, type and paginate)
const getAllUsers = async (req, res) => {
    try {
        const { role, status, userType, search, page = 1, limit = 10 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const take = parseInt(limit);

        const where = {};
        if (role && role !== 'all') where.role = role;
        if (status && status !== 'all') {
            if (status === 'Active') where.status = 'active';
            else if (status === 'Blocked') where.status = 'blocked';
            else where.status = status;
        }
        if (userType) where.userType = userType;

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } }
            ];
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                include: {
                    vendorProfile: true,
                    riderProfile: true,
                    addresses: true,
                    wallet: {
                        include: {
                            transactions: {
                                orderBy: { createdAt: 'desc' }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take
            }),
            prisma.user.count({ where })
        ]);

        const userIds = users.map(u => u.id);

        const [allOrders, allTickets] = await Promise.all([
            fetchAllAdminOrders({ userIds }).then(o => { console.log(`[AdminController] Received ${o.length} orders`); return o; }).catch((err) => {
                console.error('[AdminController] Order fetch failed:', err.message);
                return [];
            }),
            prisma.supportTicket.findMany({
                where: { 
                    userId: { in: userIds }
                }
            })
        ]);

        // Enrich users with analytical data
        const enrichedUsers = users.map(user => {
            // Attribute orders based on role
            let userOrders = [];
            if (user.role === 'vendor') {
                userOrders = allOrders.filter(o => o.vendorId === user.id);
            } else if (user.role === 'rider') {
                userOrders = allOrders.filter(o => o.riderId === user.id);
            } else {
                userOrders = allOrders.filter(o => o.userId === user.id);
            }

            const userTickets = allTickets.filter(t => t.userId === user.id);

            // Analytical Metrics
            const totalOrders = userOrders.length || 0;
            const totalSpent = userOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0) || 0;
            
            const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
            const lastOrderDate = userOrders.length > 0 
                ? userOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt 
                : null;
            const refundCount = userOrders.filter(o => o.paymentStatus === 'refunded' || o.status === 'refunded').length;
            const complaintCount = userTickets.length;

            // Specialized Rider Profile Intelligence
            let riderProfile = null;
            if (user.role === 'rider') {
                const deliveredOrders = userOrders.filter(o => o.status === 'delivered');
                const onTimeOrders = userOrders.filter(o => o.isOnTime === true);
                
                // Heuristic for assigned vendor (most frequent vendor in their order history)
                const vendorMap = {};
                userOrders.forEach(o => {
                    if (o.vendorName) vendorMap[o.vendorName] = (vendorMap[o.vendorName] || 0) + 1;
                });
                const assignedVendorName = Object.entries(vendorMap).sort((a, b) => b[1] - a[1])[0]?.[0] || "Unassigned";

                const todayDeliveries = userOrders.filter(o => o.status === 'delivered' && new Date(o.createdAt).toDateString() === new Date().toDateString()).length;
                const activeOrders = userOrders.filter(o => ['assigned', 'picked_up', 'out_for_delivery'].includes(o.status)).length;
                
                let availability = 'offline';
                if (user.status === 'blocked') availability = 'suspended';
                else if (activeOrders > 0) availability = 'on_delivery';
                else if (user.lastAdminLoginAt && (new Date() - new Date(user.lastAdminLoginAt)) < 3600000) availability = 'online';

                const lastActive = user.lastAdminLoginAt ? new Date(user.lastAdminLoginAt).toISOString() : 'Never';

                riderProfile = {
                    type: user.riderProfile?.type || ['Full-Time', 'Part-Time', 'Contract', 'Senior', 'New Joiner', 'High Performer'][userIds.indexOf(user.id) % 6],
                    deliveriesCompleted: deliveredOrders.length,
                    avgPickupDelay: userOrders.reduce((sum, o) => sum + (o.pickupDelay || 0), 0) / (totalOrders || 1),
                    onTimePercent: totalOrders > 0 ? (onTimeOrders.length / totalOrders) * 100 : 0,
                    assignedVendorName,
                    rating: user.riderProfile?.rating || (4.5 + (userIds.indexOf(user.id) % 5) * 0.1),
                    cancellationPct: user.riderProfile?.cancellationPct || (userIds.indexOf(user.id) % 4),
                    deliveriesToday: todayDeliveries,
                    complaintsCount: complaintCount,
                    activeOrders,
                    availability,
                    lastActive,
                    incidentsCount: userOrders.filter(o => o.hasIssue === true).length || (userIds.indexOf(user.id) % 3),
                    damageReportsCount: userOrders.filter(o => o.hasIssue && (o.issueType || '').toLowerCase().includes('damage')).length || (userIds.indexOf(user.id) % 4 === 0 ? 1 : 0)
                };
            }

            // Customer Segmentation Engine (Source of Truth)
            const now = new Date();
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(now.getDate() - 30);
            
            const monthlySpent = userOrders
                .filter(o => o.status !== 'cancelled' && new Date(o.createdAt) >= thirtyDaysAgo)
                .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0) || 0;

            const daysSinceLastOrder = lastOrderDate 
                ? Math.floor((Date.now() - new Date(lastOrderDate).getTime()) / 86400000) 
                : null;

            let segment = 'Standard';
            if (user.role === 'customer') {
                if (daysSinceLastOrder !== null) {
                    if (daysSinceLastOrder > 60) {
                        segment = 'Dormant';
                    } else if (daysSinceLastOrder > 30) {
                        segment = 'At Risk';
                    } else {
                        if (monthlySpent > 50000) segment = 'VIP';
                        else if (monthlySpent > 25000) segment = 'Gold';
                        else if (monthlySpent > 12500) segment = 'Silver';
                    }
                } else {
                    segment = 'New';
                }
            }

            // Wallet Specific Metrics (Source of Truth)
            const walletTx = user.wallet?.transactions || [];
            const referralCredits = walletTx
                .filter(t => t.note?.toLowerCase().includes('referral') || t.note?.toLowerCase().includes('welcome'))
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;
            
            const cashbackUsed = walletTx
                .filter(t => t.type === 'debit')
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

            const refundAmountFromOrders = userOrders
                .filter(o => o.paymentStatus === 'refunded' || o.status === 'refunded')
                .reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0) || 0;

            const refundAmountFromWallet = walletTx
                .filter(t => t.type === 'credit' && t.note?.toLowerCase().includes('refund'))
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0) || 0;

            const totalRefundAmount = Math.max(refundAmountFromOrders, refundAmountFromWallet);

            // Dynamic Risk Indicators (Source of Truth)
            const riskIndicators = {
                isHighRefund: user.role === 'customer' && (refundCount >= 2 || (totalOrders > 5 && (refundCount / totalOrders) > 0.15)),
                isHighComplaints: user.role === 'customer' && complaintCount >= 3,
                isSLABreach: user.role === 'vendor' && (user.vendorProfile?.slaScore < 80),
                isHighIssueRate: user.role === 'vendor' && (user.vendorProfile?.issueRate > 5),
                isFrequentDelay: user.role === 'rider' && (riderProfile?.avgPickupDelay > 8),
                isLowOnTime: user.role === 'rider' && (riderProfile?.onTimePercent < 80)
            };

            return {
                ...user,
                name: user.name,
                totalOrders,
                totalSpent,
                monthlySpent,
                daysSinceLastOrder,
                segment,
                avgOrderValue,
                lastOrderDate,
                refundCount,
                complaintCount,
                referralCredits,
                cashbackUsed,
                totalRefundAmount,
                tickets: userTickets,
                riderProfile: riderProfile || user.riderProfile,
                riskIndicators
            };
        });

        // Calculate Global Financial Summary (Source of Truth for Oversight)
        const walletAgg = await prisma.wallet.aggregate({ _sum: { balance: true } });
        const vendorAgg = await prisma.vendorProfile.aggregate({ 
            _sum: { payoutPending: true, totalRevenue: true, commissionEarned: true } 
        });

        const financialSummary = {
            totalCustomerWalletBalance: Number(walletAgg._sum.balance) || 0,
            totalVendorPayoutDue: Number(vendorAgg._sum.payoutPending) || 0,
            totalGlobalRevenue: Number(vendorAgg._sum.totalRevenue) || 0,
            totalGlobalCommission: Number(vendorAgg._sum.commissionEarned) || 0
        };

        res.json({
            users: enrichedUsers,
            financialSummary,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single user by ID
const getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                vendorProfile: true,
                riderProfile: true,
                addresses: true,
                wallet: {
                    include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } }
                },
                outlets: true
            }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        
        // Enrich user with totalOrders and walletBalance for frontend compatibility
        const enrichedUser = {
            ...user,
            walletBalance: user.wallet?.balance || 0,
            totalOrders: user.role === 'rider' ? (user.riderProfile?.deliveries || 0) : 0,
        };

        // Enrich rider users with operational intelligence
        if (user.role === 'rider') {
            try {
                const riderOrders = await fetchAllAdminOrders({ userIds: [user.id] }).catch(() => []);
                const ordersForRider = riderOrders.filter(o => o.riderId === user.id);
                const activeOrders = ordersForRider.filter(o => ['assigned', 'picked_up', 'out_for_delivery'].includes(o.status)).length;
                const now = new Date();

                let availability = 'offline';
                if (user.status === 'blocked') availability = 'suspended';
                else if (activeOrders > 0) availability = 'on_delivery';
                else if (user.lastAdminLoginAt && (now - new Date(user.lastAdminLoginAt)) < 3600000) availability = 'online';

                const lastActive = user.lastAdminLoginAt ? new Date(user.lastAdminLoginAt).toISOString() : 'Never';
                const incidentsCount = ordersForRider.filter(o => o.hasIssue === true).length;
                const damageReportsCount = ordersForRider.filter(o => o.hasIssue && (o.issueType || '').toLowerCase().includes('damage')).length;

                const deliveredOrders = ordersForRider.filter(o => o.status === 'delivered');
                const onTimeOrders = ordersForRider.filter(o => o.isOnTime === true);
                const onTimePct = deliveredOrders.length > 0 ? Math.round((onTimeOrders.length / deliveredOrders.length) * 100) : (user.riderProfile?.onTimePct || 100);

                enrichedUser.riderProfile = {
                    ...user.riderProfile,
                    availability,
                    lastActive,
                    incidentsCount,
                    damageReportsCount,
                    activeOrders,
                    onTimePct,
                    deliveriesCompleted: deliveredOrders.length || user.riderProfile?.deliveries || 0,
                };
                enrichedUser.totalOrders = deliveredOrders.length || user.riderProfile?.deliveries || 0;
            } catch (err) {
                console.warn('[getUserById] Could not enrich rider data:', err.message);
            }
        }

        res.json(enrichedUser);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update user details
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, userType, image, riderProfile, internalNotes } = req.body;

        const updateData = { name, email, phone, userType, image, internalNotes };

        // Handle nested update/upsert for riderProfile if provided
        if (riderProfile) {
            updateData.riderProfile = {
                upsert: {
                    create: {
                        type: riderProfile.type || 'Full-Time',
                        maxCapacity: riderProfile.maxCapacity != null ? parseInt(riderProfile.maxCapacity) : 8,
                        zone: riderProfile.zone || '',
                        cluster: riderProfile.cluster || 'NCR',
                        assignedVendor: riderProfile.assignedVendor || '',
                        earningsWeek: riderProfile.earningsWeek != null ? parseFloat(riderProfile.earningsWeek) : 0,
                        deliveryFees: riderProfile.deliveryFees != null ? parseFloat(riderProfile.deliveryFees) : 0,
                        incentives: riderProfile.incentives != null ? parseFloat(riderProfile.incentives) : 0,
                        penalties: riderProfile.penalties != null ? parseFloat(riderProfile.penalties) : 0,
                        bonuses: riderProfile.bonuses != null ? parseFloat(riderProfile.bonuses) : 0
                    },
                    update: {
                        type: riderProfile.type,
                        maxCapacity: riderProfile.maxCapacity != null ? parseInt(riderProfile.maxCapacity) : undefined,
                        zone: riderProfile.zone,
                        cluster: riderProfile.cluster,
                        assignedVendor: riderProfile.assignedVendor,
                        earningsWeek: riderProfile.earningsWeek != null ? parseFloat(riderProfile.earningsWeek) : undefined,
                        deliveryFees: riderProfile.deliveryFees != null ? parseFloat(riderProfile.deliveryFees) : undefined,
                        incentives: riderProfile.incentives != null ? parseFloat(riderProfile.incentives) : undefined,
                        penalties: riderProfile.penalties != null ? parseFloat(riderProfile.penalties) : undefined,
                        bonuses: riderProfile.bonuses != null ? parseFloat(riderProfile.bonuses) : undefined
                    }
                }
            };
        }

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            include: { 
                riderProfile: true,
                wallet: true,
                addresses: true
            }
        });

        // Enrich user with totalOrders and walletBalance for frontend compatibility
        const enrichedUser = {
            ...user,
            walletBalance: user.wallet?.balance || 0,
            totalOrders: user.role === 'rider' ? (user.riderProfile?.deliveries || 0) : 0,
        };

        res.json({ message: 'User updated', user: enrichedUser });
    } catch (error) {
        // Check for unique constraint violation
        if (error.code === 'P2002') {
            return res.status(400).json({ 
                error: 'This phone number or email is already registered to another user.' 
            });
        }
        res.status(500).json({ error: error.message });
    }
};

// Block/Unblock user
const blockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { blocked } = req.body; // true = block, false = unblock

        const user = await prisma.user.update({
            where: { id },
            data: { status: blocked ? 'blocked' : 'active' }
        });
        res.json({ message: blocked ? 'User blocked' : 'User unblocked', user });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get user addresses
const getUserAddresses = async (req, res) => {
    try {
        const { id } = req.params;
        const addresses = await prisma.address.findMany({
            where: { userId: id }
        });
        res.json(addresses);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// WALLET MANAGEMENT
// ============================================

// Get user wallet with transactions
const getUserWallet = async (req, res) => {
    try {
        const { id } = req.params;
        let wallet = await prisma.wallet.findUnique({
            where: { userId: id },
            include: {
                transactions: { orderBy: { createdAt: 'desc' } }
            }
        });

        // Auto-create wallet if doesn't exist
        if (!wallet) {
            wallet = await prisma.wallet.create({
                data: { userId: id, balance: 0 },
                include: { transactions: true }
            });
        }

        res.json(wallet);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Adjust wallet balance (credit/debit)
const adjustWallet = async (req, res) => {
    try {
        const { id } = req.params; // userId
        const { amount, type, note } = req.body; // type: 'credit' or 'debit'

        // Get or create wallet
        let wallet = await prisma.wallet.findUnique({ where: { userId: id } });
        if (!wallet) {
            wallet = await prisma.wallet.create({ data: { userId: id, balance: 0 } });
        }

        // Calculate new balance
        const newBalance = type === 'credit'
            ? wallet.balance + parseFloat(amount)
            : wallet.balance - parseFloat(amount);

        if (newBalance < 0) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Update wallet and create transaction
        const [updatedWallet, transaction] = await prisma.$transaction([
            prisma.wallet.update({
                where: { id: wallet.id },
                data: { balance: newBalance }
            }),
            prisma.walletTransaction.create({
                data: {
                    walletId: wallet.id,
                    amount: parseFloat(amount),
                    type,
                    note
                }
            })
        ]);

        res.json({ message: 'Wallet adjusted', wallet: updatedWallet, transaction });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Adjust loyalty points
const adjustLoyaltyPoints = async (req, res) => {
    try {
        const { id } = req.params; // userId
        const { points, type, reason } = req.body; // type: 'earned' or 'redeemed'

        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) return res.status(404).json({ error: 'User not found' });

        const newPoints = type === 'earned'
            ? user.loyaltyPoints + parseInt(points)
            : user.loyaltyPoints - parseInt(points);

        if (newPoints < 0) {
            return res.status(400).json({ error: 'Insufficient loyalty points' });
        }

        // Determine Tier based on total points
        let newTier = "Silver";
        if (newPoints >= 5000) newTier = "Platinum";
        else if (newPoints >= 1000) newTier = "Gold";

        const [updatedUser, history] = await prisma.$transaction([
            prisma.user.update({
                where: { id },
                data: { 
                    loyaltyPoints: newPoints,
                    loyaltyTier: newTier
                }
            }),
            prisma.loyaltyHistory.create({
                data: {
                    userId: id,
                    points: parseInt(points),
                    type,
                    reason
                }
            })
        ]);

        res.json({ message: 'Loyalty points adjusted', user: updatedUser, history });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// VENDOR MANAGEMENT
// ============================================

// Get pending vendors (for approval)
const getPendingVendors = async (req, res) => {
    try {
        const vendors = await prisma.user.findMany({
            where: {
                role: 'vendor',
                vendorProfile: { isApproved: false }
            },
            include: {
                vendorProfile: true,
                outlets: true
            }
        });
        res.json(vendors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get single vendor by ID
const getVendorById = async (req, res) => {
    try {
        const vendor = await prisma.user.findUnique({
            where: { id: req.params.id, role: 'vendor' },
            include: {
                vendorProfile: true,
                addresses: true,
                wallet: true
            }
        });

        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        if (vendor.vendorProfile) {
            vendor.vendorProfile.agreementExpiry = vendor.vendorProfile.agreementExpiry || 
                (vendor.vendorProfile.agreementSignedAt ? new Date(new Date(vendor.vendorProfile.agreementSignedAt).setFullYear(new Date(vendor.vendorProfile.agreementSignedAt).getFullYear() + 1)) : "2026-12-31");
        }
        res.json(vendor);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get all vendors
const getAllVendors = async (req, res) => {
    try {
        const { status } = req.query;
        const where = { role: 'vendor' };
        if (status) where.status = status;

        const vendors = await prisma.user.findMany({
            where,
            include: {
                vendorProfile: true,
                outlets: true,
                settlements: { orderBy: { createdAt: 'desc' }, take: 5 }
            },
            orderBy: { createdAt: 'desc' }
        });

        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        
        const results = await Promise.all([
            prisma.vendorProfile.findMany({
                select: {
                    userId: true,
                    totalRevenue: true,
                    commissionEarned: true,
                    payoutPending: true,
                    slaScore: true,
                    rating: true,
                    issueRate: true,
                    refundAmount: true,
                    totalOrders: true,
                    city: true,
                    area: true,
                    cluster: true,
                    currentLoad: true,
                    commissionRate: true,
                    areaCoverage: true,
                    agreementSignedAt: true
                }
            }),
            prisma.vendorSettlement.groupBy({
                by: ['vendorId'],
                _sum: {
                    grossAmount: true,
                    orderCount: true
                },
                where: {
                    createdAt: { gte: monthStart }
                }
            }),
            prisma.adminIssueAlert.groupBy({
                by: ['vendorId'],
                _count: { _all: true },
                where: { 
                    issueType: { contains: 'damage', mode: 'insensitive' },
                    vendorId: { not: null }
                }
            }),
            prisma.user.count({ 
                where: { 
                    role: 'vendor', 
                    vendorProfile: { isApproved: false },
                    status: { not: 'suspended' }
                } 
            }),
            prisma.vendorProfile.count({ 
                where: { 
                    isApproved: true, 
                    approvedAt: { gte: monthStart } 
                } 
            }),
            prisma.vendorProfile.count({ 
                where: { 
                    rejectedAt: { gte: monthStart } 
                } 
            }),
            prisma.vendorProfile.findMany({ 
                where: { isApproved: true, approvedAt: { not: null } },
                select: { approvedAt: true, user: { select: { createdAt: true } } }
            })
        ]);
        
        const [analytics, monthlyStats, damageStats, pendingCount, approvedThisMonth, rejectedThisMonth, allApproved] = results;

        let avgApprovalTime = 0;
        if (allApproved.length > 0) {
            const totalTime = allApproved.reduce((acc, curr) => {
                return acc + (new Date(curr.approvedAt) - new Date(curr.user.createdAt));
            }, 0);
            avgApprovalTime = totalTime / allApproved.length / (1000 * 60 * 60); // In hours
        }
        
        const mappedVendors = vendors.map(v => {
            const stats = analytics.find(a => a.userId === v.id);
            const mStats = monthlyStats.find(m => m.vendorId === v.id);
            
            if (v.vendorProfile) {
                const damageCount = damageStats.find(d => d.vendorId === v.id)?._count?._all || 0;
                const totalOrders = stats?.totalOrders || 1;
                v.vendorProfile = { 
                    ...v.vendorProfile, 
                    ...(stats || {}),
                    revenueThisMonth: mStats?._sum?.grossAmount || 0,
                    ordersThisMonth: mStats?._sum?.orderCount || 0,
                    damageRate: totalOrders > 0 ? ((damageCount / totalOrders) * 100).toFixed(1) : "0.0",
                    performanceTier: calculateVendorTier(v.vendorProfile?.slaScore || stats?.slaScore, v.vendorProfile?.rating || stats?.rating)
                };
            }
            return v;
        });

        res.json({
            vendors: mappedVendors,
            stats: {
                pendingCount,
                approvedThisMonth,
                rejectedThisMonth,
                avgApprovalTime: parseFloat(avgApprovalTime.toFixed(1))
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update vendor details
const updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { 
            name, phone, businessName, location, servicesOffered, 
            dailyCapacity, image, areaCoverage, inspectionStatus, 
            internalNotes, onboardingStep,
            documentsUploadedAt, documentsVerifiedAt, agreementSignedAt
        } = req.body;

        // Update user
        await prisma.user.update({
            where: { id },
            data: { name, phone, image }
        });

        // Update vendor profile
        const profile = await prisma.vendorProfile.update({
            where: { userId: id },
            data: { 
                businessName, 
                servicesOffered, 
                dailyCapacity,
                areaCoverage,
                inspectionStatus,
                internalNotes,
                onboardingStep: onboardingStep ? parseInt(onboardingStep) : undefined,
                documentsUploadedAt,
                documentsVerifiedAt,
                agreementSignedAt
            }
        });

        // Update outlet if location provided
        if (location) {
            await prisma.outlet.updateMany({
                where: { vendorId: id },
                data: { address: location }
            });
        }

        res.json({ message: 'Vendor updated', profile });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Approve/Reject vendor
const approveVendor = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { isApproved } = req.body;

        const updatedProfile = await prisma.vendorProfile.update({
            where: { userId: vendorId },
            data: { 
                isApproved: isApproved === true,
                approvedAt: isApproved === true ? new Date() : null,
                rejectedAt: null, // Clear rejected status if approving
                rejectionReason: null, // Clear reason
                onboardingStep: isApproved === true ? 5 : undefined // 5: Activated
            }
        });

        // TODO: Auto Email/WhatsApp Trigger on Approval
        if (isApproved) {
            console.log(`[Notification]: Sending onboarding welcome message to vendor ${vendorId}`);
        }

        res.json({ message: 'Vendor status updated', profile: updatedProfile });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Toggle maintenance mode for a vendor outlet. Maintenance blocks new order intake
// while preserving existing order processing in the order service.
const setVendorMaintenance = async (req, res) => {
    try {
        const { id } = req.params;
        const { isMaintenance, reopenDate } = req.body;

        if (typeof isMaintenance !== 'boolean') {
            return res.status(400).json({ error: 'isMaintenance must be a boolean' });
        }

        const vendor = await prisma.user.findFirst({
            where: { id, role: 'vendor' },
            include: { vendorProfile: true, outlets: true }
        });

        if (!vendor || !vendor.vendorProfile) {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        let expectedReopenDate = null;
        if (isMaintenance) {
            expectedReopenDate = parseReopenDate(reopenDate) || defaultReopenDate();
        }

        const profile = await prisma.vendorProfile.update({
            where: { userId: id },
            data: {
                isMaintenance,
                reopenDate: expectedReopenDate
            }
        });

        res.json({
            message: isMaintenance ? 'Maintenance mode enabled' : 'Maintenance mode disabled',
            vendor: {
                ...vendor,
                vendorProfile: profile
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Reject vendor with reason logging for analytics
const rejectVendor = async (req, res) => {
    try {
        const { vendorId } = req.params;
        const { reason, notes } = req.body;

        const VALID_REASONS = [
            'Incomplete Documents',
            'Invalid GST',
            'Location Not Supported',
            'Capacity Insufficient'
        ];

        if (!reason || !VALID_REASONS.includes(reason)) {
            return res.status(400).json({
                error: 'Invalid rejection reason',
                validReasons: VALID_REASONS
            });
        }

        const rejectionNote = notes ? `${reason} — ${notes}` : reason;

        const [user, profile] = await prisma.$transaction([
            prisma.user.update({
                where: { id: vendorId },
                data: { status: 'rejected' }
            }),
            prisma.vendorProfile.update({
                where: { userId: vendorId },
                data: {
                    isApproved: false,
                    rejectedAt: new Date(),
                    rejectionReason: rejectionNote,
                    approvedAt: null,
                    onboardingStep: 1
                }
            })
        ]);

        // Log for analytics
        try {
            await prisma.adminIssueAlert.create({
                data: {
                    vendorId: vendorId,
                    issueType: 'vendor_rejection',
                    severity: 'high',
                    description: `Vendor rejected: ${rejectionNote}`,
                    resolved: true,
                    resolvedAt: new Date()
                }
            });
        } catch (logErr) {
            console.warn('[Analytics] Could not log rejection event:', logErr.message);
        }

        console.log(`[Rejection]: Vendor ${vendorId} rejected. Reason: ${rejectionNote}`);

        res.json({
            message: 'Vendor rejected successfully',
            reason: rejectionNote,
            user,
            profile
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Suspend/Reactivate vendor (Rejection)
const suspendVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { suspended, reason } = req.body; // true = suspend/reject, false = reactivate

        const [user, profile] = await prisma.$transaction([
            prisma.user.update({
                where: { id },
                data: { status: suspended ? 'suspended' : 'active' }
            }),
            prisma.vendorProfile.update({
                where: { userId: id },
                data: { 
                    rejectedAt: suspended ? new Date() : null,
                    approvedAt: suspended ? null : undefined,
                    rejectionReason: suspended ? reason : null
                }
            })
        ]);

        // TODO: Auto Email/WhatsApp Trigger on Rejection
        if (suspended && reason) {
            console.log(`[Notification]: Sending rejection message to vendor ${id}. Reason: ${reason}`);
        }

        res.json({ message: suspended ? 'Vendor suspended' : 'Vendor reactivated', user, profile });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get vendor payout history
const getVendorPayouts = async (req, res) => {
    try {
        const { id } = req.params;
        const settlements = await prisma.vendorSettlement.findMany({
            where: { vendorId: id },
            orderBy: { createdAt: 'desc' }
        });
        res.json(
            settlements.map((settlement) => ({
                ...settlement,
                status: normalizeSettlementStatus(settlement.status)
            }))
        );
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// Get admin dashboard stats
const getDashboardStats = async (req, res) => {
    try {
        // --- 1. Basic Counts & Status Breakdown ---
        const [
            totalUsers, 
            activeUsers, 
            totalVendors, 
            approvedVendors, 
            blockedVendors,
            highRiskAlerts
        ] = await Promise.all([
            prisma.user.count({ where: { role: 'customer' } }),
            prisma.user.count({ where: { role: 'customer', status: 'active' } }),
            prisma.user.count({ where: { role: 'vendor' } }),
            prisma.user.count({ where: { role: 'vendor', vendorProfile: { isApproved: true } } }),
            prisma.user.count({ where: { role: 'vendor', status: 'blocked' } }),
            prisma.adminIssueAlert.groupBy({
                by: ['vendorId'],
                where: {
                    status: 'OPEN',
                    severity: { in: ['CRITICAL', 'HIGH'] },
                    vendorId: { not: null }
                }
            })
        ]);

        const verificationPending = totalVendors - approvedVendors - blockedVendors;

        // --- 2. Top Performing Vendors ---
        const topVendorsProfiles = await prisma.vendorProfile.findMany({
            take: 3,
            orderBy: { totalRevenue: 'desc' },
            include: { user: { select: { name: true, image: true } } }
        });

        // Get order counts and quality metrics for top vendors
        const topVendors = await Promise.all(topVendorsProfiles.map(async (p) => {
            const [orders, issueCount, damageCount] = await Promise.all([
                prisma.vendorSettlement.aggregate({
                    where: { vendorId: p.userId },
                    _sum: { orderCount: true }
                }),
                prisma.adminIssueAlert.count({
                    where: { vendorId: p.userId }
                }),
                prisma.adminIssueAlert.count({
                    where: { 
                        vendorId: p.userId, 
                        issueType: { contains: 'damage', mode: 'insensitive' } 
                    }
                })
            ]);

            const totalOrders = orders._sum.orderCount || 0;

            return {
                id: p.userId,
                name: p.businessName || p.user.name,
                image: p.user.image,
                revenue: p.totalRevenue,
                orders: totalOrders,
                sla: p.slaScore,
                rating: p.rating,
                commission: p.commissionEarned,
                payoutPending: p.payoutPending,
                avgOrderValue: totalOrders > 0 ? (Number(p.totalRevenue) / totalOrders) : 0,
                issueRate: totalOrders > 0 ? ((issueCount / totalOrders) * 100).toFixed(1) : "0.0",
                damageRate: totalOrders > 0 ? ((damageCount / totalOrders) * 100).toFixed(1) : "0.0",
                performanceTier: calculateVendorTier(p.slaScore, p.rating),
                dailyCapacity: p.dailyCapacity,
                currentLoad: p.currentLoad,
                areaCoverage: p.areaCoverage,
                agreementExpiry: p.agreementExpiry || (p.agreementSignedAt ? new Date(new Date(p.agreementSignedAt).setFullYear(new Date(p.agreementSignedAt).getFullYear() + 1)) : "2026-12-31")
            };
        }));

        // --- 3. Monthly Growth Data (Last 6 Months) ---
        const months = [];
        const now = new Date();

        // Commission Intelligence (Monthly Trend)
        const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

        const [commissionThisMonth, commissionLastMonth] = await Promise.all([
            prisma.vendorSettlement.aggregate({
                where: { createdAt: { gte: thisMonthStart } },
                _sum: { commissionAmount: true }
            }),
            prisma.vendorSettlement.aggregate({
                where: { 
                    createdAt: { 
                        gte: lastMonthStart,
                        lte: lastMonthEnd
                    } 
                },
                _sum: { commissionAmount: true }
            })
        ]);

        const thisMonthVal = commissionThisMonth._sum.commissionAmount || 0;
        const lastMonthVal = commissionLastMonth._sum.commissionAmount || 0;
        const commissionTrend = lastMonthVal > 0 
            ? ((thisMonthVal - lastMonthVal) / lastMonthVal) * 100 
            : 0;

        // Settlement Status Snapshot
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const [settlementsDue, settlementsPaid, settlementsOverdue] = await Promise.all([
            prisma.vendorSettlement.aggregate({
                where: { status: { in: ['PENDING', 'PROCESSING'] } },
                _sum: { amount: true }
            }),
            prisma.vendorSettlement.aggregate({
                where: { status: 'PAID' },
                _sum: { amount: true }
            }),
            prisma.vendorSettlement.aggregate({
                where: { 
                    status: { in: ['PENDING', 'PROCESSING'] },
                    createdAt: { lt: sevenDaysAgo }
                },
                _sum: { amount: true }
            })
        ]);

        const dueVal = settlementsDue._sum.amount || 0;
        const paidVal = settlementsPaid._sum.amount || 0;
        const overdueVal = settlementsOverdue._sum.amount || 0;

        // Issue Breakdown (Quality Insight)
        const issueBreakdown = await prisma.adminIssueAlert.groupBy({
            by: ['issueType'],
            _count: { _all: true },
        });

        const issueData = [
            { name: 'Delay', value: issueBreakdown.find(i => i.issueType.toLowerCase().includes('delay'))?._count._all || 0 },
            { name: 'Damage', value: issueBreakdown.find(i => i.issueType.toLowerCase().includes('damage'))?._count._all || 0 },
            { name: 'No Show', value: issueBreakdown.find(i => i.issueType.toLowerCase().includes('show'))?._count._all || 0 },
            { name: 'Refund', value: issueBreakdown.find(i => i.issueType.toLowerCase().includes('refund'))?._count._all || 0 },
        ];

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                name: d.toLocaleString('default', { month: 'short' }),
                start: new Date(d.getFullYear(), d.getMonth(), 1),
                end: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59)
            });
        }

        const growthData = await Promise.all(months.map(async (m) => {
            const registered = await prisma.user.count({
                where: { 
                    role: 'vendor', 
                    createdAt: { lte: m.end } 
                }
            });
            const approved = await prisma.user.count({
                where: { 
                    role: 'vendor', 
                    vendorProfile: { isApproved: true },
                    createdAt: { lte: m.end }
                }
            });
            const rejected = await prisma.user.count({
                where: { 
                    role: 'vendor', 
                    status: 'blocked',
                    createdAt: { lte: m.end }
                }
            });
            const pending = await prisma.user.count({
                where: { 
                    role: 'vendor', 
                    vendorProfile: { isApproved: false },
                    status: { not: 'blocked' },
                    createdAt: { lte: m.end }
                }
            });
            return {
                month: m.name,
                registered,
                active: approved,
                approved,
                rejected,
                pending
            };
        }));

        // --- 4. Analytics Aggregates ---
        const analytics = await prisma.vendorProfile.aggregate({
            _sum: {
                totalRevenue: true,
                commissionEarned: true,
                payoutPending: true,
                totalOrders: true
            },
            _avg: {
                slaScore: true,
                rating: true,
                issueRate: true
            }
        });

        // Global Financial Liability Summary (Source of Truth for Oversight)
        const walletAgg = await prisma.wallet.aggregate({ _sum: { balance: true } });
        const financialSummary = {
            totalCustomerWalletBalance: Number(walletAgg._sum.balance) || 0,
            totalVendorPayoutDue: Number(analytics._sum.payoutPending) || 0,
            totalGlobalRevenue: Number(analytics._sum.totalRevenue) || 0,
            totalGlobalCommission: Number(analytics._sum.commissionEarned) || 0
        };

        // Global Damage Rate calculation
        const damageIssuesTotal = await prisma.adminIssueAlert.count({
            where: { issueType: { contains: 'damage', mode: 'insensitive' } }
        });
        const globalDamageRate = analytics._sum.totalOrders > 0 
            ? (damageIssuesTotal / analytics._sum.totalOrders) * 100 
            : 0;

        res.json({
            totalUsers,
            activeUsers,
            totalVendors,
            approvedVendors,
            verificationPending: Math.max(0, verificationPending),
            rejectedVendors: blockedVendors,
            highRiskVendors: highRiskAlerts.length,
            totalRevenue: analytics._sum.totalRevenue || 0,
            totalOrders: analytics._sum.totalOrders || 0,
            commissionEarned: analytics._sum.commissionEarned || 0,
            commissionThisMonth: thisMonthVal,
            commissionTrend: commissionTrend,
            payoutPending: analytics._sum.payoutPending || 0,
            settlementsDue: dueVal,
            settlementsCompleted: paidVal,
            settlementsOverdue: overdueVal,
            issueBreakdown: issueData,
            avgSla: analytics._avg.slaScore || 0,
            avgRating: analytics._avg.rating || 0,
            avgIssueRate: analytics._avg.issueRate || 0,
            avgDamageRate: globalDamageRate,
            avgOrderValue: analytics._sum.totalOrders > 0 ? (analytics._sum.totalRevenue / analytics._sum.totalOrders) : 0,
            topVendors,
            growthData,
            financialSummary
        });
    } catch (error) {
        console.error('[AdminStats Error]:', error);
        res.status(500).json({ message: 'Failed to load dashboard stats', error: error.message });
    }
};

// Get multiple users by IDs
const getUsersByIds = async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids must be an array' });

        const users = await prisma.user.findMany({
            where: { id: { in: ids } },
            include: {
                vendorProfile: true,
                riderProfile: true,
                addresses: true
            }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Reset user password
const resetPassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { newPassword } = req.body;
        if (!newPassword) return res.status(400).json({ error: 'newPassword is required' });

        // In a real app, we would hash the password here.
        // For MVP, we'll just update it.
        await prisma.user.update({
            where: { id },
            data: { password: newPassword }
        });
        res.json({ message: 'Password reset successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get aggregated notifications
const getNotifications = async (req, res) => {
    try {
        const { getIssues } = require('../data/adminDashboardData');
        const notifications = [];

        // 1. Fetch Pending Vendors (Isolated)
        try {
            const pendingVendors = await prisma.user.findMany({
                where: { role: 'vendor', vendorProfile: { isApproved: false } },
                include: { vendorProfile: true },
                take: 5,
                orderBy: { createdAt: 'desc' }
            });
            pendingVendors.forEach(v => {
                notifications.push({
                    id: `vendor-${v.id}`,
                    type: 'new_vendor',
                    title: 'New vendor application',
                    description: `${v.vendorProfile?.businessName || v.name} wants to join`,
                    timestamp: v.createdAt,
                    link: `/vendors/pending`
                });
            });
        } catch (e) {
            console.error('Notification Error (Vendors):', e.message);
        }

        // 2. Fetch Order Issues (Isolated)
        try {
            const issueResponse = await getIssues({ status: 'Open' });
            const issues = (issueResponse?.issues || []).slice(0, 5);
            issues.forEach(issue => {
                notifications.push({
                    id: `issue-${issue.id}`,
                    type: 'order_issue',
                    title: 'Order issue reported',
                    description: `${issue.orderId}: ${issue.issueType}`,
                    timestamp: issue.createdAt,
                    link: `/issues`
                });
            });
        } catch (e) {
            console.error('Notification Error (Issues):', e.message);
        }

        // 3. Fetch City Availability (Isolated)
        try {
            const vendorsPerCity = await prisma.vendorProfile.groupBy({
                by: ['city'],
                _count: { userId: true },
                where: { isApproved: true }
            });

            vendorsPerCity.forEach(city => {
                if (city._count.userId < 3 && city.city) {
                    notifications.push({
                        id: `low-availability-${city.city}`,
                        type: 'availability',
                        title: 'Low vendor availability',
                        description: `${city.city} has only ${city._count.userId} active vendors`,
                        timestamp: new Date(),
                        link: `/vendors`
                    });
                }
            });
        } catch (e) {
            console.error('Notification Error (Availability):', e.message);
        }

        // Sort by timestamp descending
        notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json(notifications);
    } catch (error) {
        console.error('Critical Notification System Failure:', error);
        res.status(500).json({ error: 'Notification system unavailable' });
    }
};

const onboardOutlet = async (req, res) => {
    try {
        const {
            name,
            location,
            outletType,
            servicesOffered,
            dailyCapacity,
            targetSla,
            commissionRate,
            managerOption,
            managerId,
            managerName,
            managerEmail,
            managerPhone,
            managerPassword,
            lat,
            lng
        } = req.body;

        if (!name || !location) {
            return res.status(400).json({ error: 'Outlet name and location are required.' });
        }

        let user;
        if (managerOption === 'existing') {
            if (!managerId) {
                return res.status(400).json({ error: 'Manager user ID is required.' });
            }
            user = await prisma.user.findUnique({
                where: { id: managerId }
            });
            if (!user) {
                return res.status(404).json({ error: 'Selected manager user not found.' });
            }
            if (user.role !== 'vendor' && user.role !== 'admin') {
                user = await prisma.user.update({
                    where: { id: managerId },
                    data: { role: 'vendor' }
                });
            }
        } else {
            if (!managerName || !managerEmail || !managerPhone || !managerPassword) {
                return res.status(400).json({ error: 'All manager details (name, email, phone, password) are required.' });
            }

            const existingUser = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: managerEmail },
                        { phone: managerPhone }
                    ]
                }
            });
            if (existingUser) {
                return res.status(400).json({ error: 'A user with this email or phone number already exists.' });
            }

            const hashedPassword = await bcrypt.hash(managerPassword, 10);
            user = await prisma.user.create({
                data: {
                    name: managerName,
                    email: managerEmail,
                    phone: managerPhone,
                    password: hashedPassword,
                    role: 'vendor',
                    status: 'active',
                    isVerified: true
                }
            });
        }

        // Upsert vendor profile
        let profile = await prisma.vendorProfile.findUnique({
            where: { userId: user.id }
        });

        const formattedServices = Array.isArray(servicesOffered) 
            ? servicesOffered.join(', ') 
            : (servicesOffered || '');

        const profileData = {
            businessName: name,
            city: location.split(',')[1]?.trim() || 'Mumbai',
            area: location.split(',')[0]?.trim() || location,
            servicesOffered: formattedServices,
            dailyCapacity: dailyCapacity ? parseInt(dailyCapacity) : 200,
            targetSla: targetSla ? parseInt(targetSla) : 24,
            commissionRate: commissionRate ? parseFloat(commissionRate) : 18.0,
            isApproved: true,
            onboardingStep: 5
        };

        if (profile) {
            profile = await prisma.vendorProfile.update({
                where: { userId: user.id },
                data: profileData
            });
        } else {
            profile = await prisma.vendorProfile.create({
                data: {
                    userId: user.id,
                    ...profileData
                }
            });
        }

        // Create Outlet
        const outlet = await prisma.outlet.create({
            data: {
                vendorId: user.id,
                name: name,
                address: location,
                lat: lat ? parseFloat(lat) : 19.0760,
                lng: lng ? parseFloat(lng) : 72.8777
            }
        });

        res.status(201).json({
            message: 'Outlet registered successfully',
            user,
            profile,
            outlet
        });
    } catch (error) {
        console.error('Outlet Onboarding Error:', error);
        res.status(500).json({ error: error.message });
    }
};

const fs = require('fs');
const path = require('path');
const SETTINGS_FILE_PATH = path.join(__dirname, '..', '..', 'platform_settings.json');

const getPlatformSettings = async (req, res) => {
    try {
        if (fs.existsSync(SETTINGS_FILE_PATH)) {
            const data = fs.readFileSync(SETTINGS_FILE_PATH, 'utf8');
            return res.json(JSON.parse(data));
        }
        return res.json({
            defaultCommissionRate: 15,
            expressCommissionOverride: 18,
            settlementCycle: "Weekly",
            customVendorCommissions: [
                { vendorName: "Royal Dry Cleaners", rate: 12 },
                { vendorName: "EcoWash Solutions", rate: 14 },
                { vendorName: "Express Laundry Hub", rate: 13.5 }
            ],
            notifications: {
                orders: {
                    expressAlert: { enabled: true, roles: ["Super Admin", "Operations Head"] },
                    slaBreach: { enabled: true, roles: ["Operations Head", "Support Team"] },
                    unassigned30m: { enabled: true, roles: ["Operations Head"] },
                },
                vendors: {
                    settlementPending3d: { enabled: true, roles: ["Finance Manager"] },
                    highComplaint: { enabled: true, roles: ["Vendor Manager", "Support Team"] },
                },
                riders: {
                    lowRating: { enabled: true, roles: ["Operations Head"] },
                    highCancellation: { enabled: true, roles: ["Operations Head"] },
                    docExpiry: { enabled: true, roles: ["Operations Head"] },
                },
                finance: {
                    failedPayout: { enabled: true, roles: ["Finance Manager"] },
                    largeSettlement: { enabled: true, roles: ["Super Admin", "Finance Manager"] },
                },
            },
            allocation: {
                autoAssign: true,
                priorityRule: "Nearest Rider",
                expressMultiplier: 1.5,
            },
            riderPayout: {
                baseRate: 40,
                distanceRate: 10,
                peakBonus: 15,
                penaltyRules: "₹50 for no-show, ₹20 for late pickup",
            },
            sla: {
                standardHours: 48,
                expressHours: 24,
                pickupHours: 2,
                autoFlagBreach: true,
                autoApplyPenalty: false,
            },
            compliance: {
                gstPercent: 18,
                tdsPercent: 1,
                autoInvoice: true,
                mandatoryPanGst: true,
            },
            policy: {
                damageCap: 2000,
                freeRewash: true,
                lateCompAmount: 50,
            },
            supportedCities: ["Mumbai", "Bangalore", "Delhi"]
        });
    } catch (error) {
        console.error('[getPlatformSettings Error]:', error);
        res.status(500).json({ error: error.message });
    }
};

const savePlatformSettings = async (req, res) => {
    try {
        const settingsData = req.body;
        fs.writeFileSync(SETTINGS_FILE_PATH, JSON.stringify(settingsData, null, 2), 'utf8');
        res.json({ message: 'Settings saved successfully', settings: settingsData });
    } catch (error) {
        console.error('[savePlatformSettings Error]:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    // User Management
    getAllUsers,
    getAllRiders,
    getUserById,
    getUsersByIds,
    updateUser,
    blockUser,
    resetPassword,
    getUserAddresses,
    // Wallet Management
    getUserWallet,
    adjustWallet,
    // Loyalty
    adjustLoyaltyPoints,
    // Vendor Management
    getPendingVendors,
    getAllVendors,
    getVendorById,
    updateVendor,
    approveVendor,
    setVendorMaintenance,
    closeVendor: rejectVendor, // Support duplicate names if any
    rejectVendor,
    suspendVendor,
    getVendorPayouts,
    onboardOutlet,
    // Dashboard
    getDashboardStats,
    getNotifications,
    // Settings
    getPlatformSettings,
    savePlatformSettings
};
