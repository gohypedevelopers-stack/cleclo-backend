const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function normalizeSettlementStatus(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'processing') return 'processing';
    if (normalized === 'paid') return 'paid';
    if (normalized === 'failed') return 'failed';
    return 'pending';
}

// ============================================
// USER MANAGEMENT
// ============================================

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
                    addresses: true,
                    wallet: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            users,
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
                addresses: true,
                wallet: {
                    include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } }
                },
                outlets: true
            }
        });
        if (!user) return res.status(404).json({ error: 'User not found' });
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update user details
const updateUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, userType, image } = req.body;

        const user = await prisma.user.update({
            where: { id },
            data: { name, email, phone, userType, image }
        });
        res.json({ message: 'User updated', user });
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

        // Bypass Prisma Client type lock for the new analytical fields by querying raw
        const analytics = await prisma.$queryRawUnsafe('SELECT "userId", "totalRevenue", "commissionEarned", "payoutPending", "slaScore", "rating", "issueRate" FROM "VendorProfile"');
        const mappedVendors = vendors.map(v => {
            const stats = analytics.find(a => a.userId === v.id);
            if (stats && v.vendorProfile) {
                v.vendorProfile = { ...v.vendorProfile, ...stats };
            }
            return v;
        });

        res.json(mappedVendors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update vendor details
const updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, businessName, location, servicesOffered, dailyCapacity, image } = req.body;

        // Update user
        await prisma.user.update({
            where: { id },
            data: { name, phone, image }
        });

        // Update vendor profile
        const profile = await prisma.vendorProfile.update({
            where: { userId: id },
            data: { businessName, servicesOffered, dailyCapacity }
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
            data: { isApproved: isApproved === true }
        });

        res.json({ message: 'Vendor status updated', profile: updatedProfile });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Suspend/Reactivate vendor
const suspendVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { suspended } = req.body; // true = suspend, false = reactivate

        const user = await prisma.user.update({
            where: { id },
            data: { status: suspended ? 'suspended' : 'active' }
        });
        res.json({ message: suspended ? 'Vendor suspended' : 'Vendor reactivated', user });
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
// DASHBOARD STATS
// ============================================

// Get admin dashboard stats
const getDashboardStats = async (req, res) => {
    try {
        // Get counts
        const [totalUsers, activeUsers, totalVendors, pendingVendors] = await Promise.all([
            prisma.user.count({ where: { role: 'customer' } }),
            prisma.user.count({ where: { role: 'customer', status: 'active' } }),
            prisma.user.count({ where: { role: 'vendor' } }),
            prisma.user.count({ where: { role: 'vendor', vendorProfile: { isApproved: false } } })
        ]);

        res.json({
            totalUsers,
            activeUsers,
            totalVendors,
            pendingVendors,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
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
        
        const [pendingVendors, issueResponse] = await Promise.all([
            prisma.user.findMany({
                where: { role: 'vendor', vendorProfile: { isApproved: false } },
                include: { vendorProfile: true },
                take: 5,
                orderBy: { createdAt: 'desc' }
            }),
            getIssues({ status: 'Open' })
        ]);

        const issues = (issueResponse?.issues || []).slice(0, 5);
        const notifications = [];

        // 1. Pending Vendors
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

        // 2. Order Issues
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

        // 3. Low Availability (Placeholder/Simulated for now based on active vendors)
        // In a real app, this would be a calculated metric
        const vendorsPerCity = await prisma.vendorProfile.groupBy({
            by: ['city'],
            _count: { userId: true },
            where: { isApproved: true }
        });

        vendorsPerCity.forEach(city => {
            if (city._count.userId < 3) {
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

        // Sort by timestamp descending
        notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        res.json(notifications);
    } catch (error) {
        console.error('Failed to fetch notifications:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    // User Management
    getAllUsers,
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
    suspendVendor,
    getVendorPayouts,
    // Dashboard
    getDashboardStats,
    getNotifications
};
