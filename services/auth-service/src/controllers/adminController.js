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

// Get all users (can filter by role, status, type)
const getAllUsers = async (req, res) => {
    try {
        const { role, status, userType } = req.query;
        const where = {};
        if (role) where.role = role;
        if (status) where.status = status;
        if (userType) where.userType = userType;

        const users = await prisma.user.findMany({
            where,
            include: {
                vendorProfile: true,
                addresses: true,
                wallet: true
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
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
        const { name, email, phone, userType } = req.body;

        const user = await prisma.user.update({
            where: { id },
            data: { name, email, phone, userType }
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
        res.json(vendors);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update vendor details
const updateVendor = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, businessName, location, servicesOffered, dailyCapacity } = req.body;

        // Update user
        await prisma.user.update({
            where: { id },
            data: { name, phone }
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

        // Note: Orders are in a different service, so we return what we can
        // The frontend should call order-service separately for order stats

        res.json({
            totalUsers,
            activeUsers,
            totalVendors,
            pendingVendors,
            // These would need to be fetched from order-service
            // totalOrders: 0,
            // revenue: 0
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    // User Management
    getAllUsers,
    getUserById,
    updateUser,
    blockUser,
    getUserAddresses,
    // Wallet Management
    getUserWallet,
    adjustWallet,
    // Vendor Management
    getPendingVendors,
    getAllVendors,
    updateVendor,
    approveVendor,
    suspendVendor,
    getVendorPayouts,
    // Dashboard
    getDashboardStats
};
