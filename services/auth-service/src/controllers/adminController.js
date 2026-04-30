const prisma = require('../utils/prisma');

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
                    addresses: true,
                    wallet: true
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take
            }),
            prisma.user.count({ where })
        ]);

        const userIds = users.map(u => u.id);

        const [allOrders, allTickets] = await Promise.all([
            fetchAllAdminOrders({ userIds }).catch((err) => {
                console.error('[AdminController] Order fetch failed:', err.message);
                return [];
            }),
            prisma.supportTicket.findMany({
                where: { 
                    userId: { in: userIds },
                    category: { in: ['order', 'complaint', 'orders'] } 
                }
            })
        ]);

        // Enrich users with analytical data
        const enrichedUsers = users.map(user => {
            const userOrders = allOrders.filter(o => o.userId === user.id);
            const userTickets = allTickets.filter(t => t.userId === user.id);

            const totalOrders = userOrders.length;
            const totalSpent = userOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
            const avgOrderValue = totalOrders > 0 ? totalSpent / totalOrders : 0;
            const lastOrderDate = userOrders.length > 0 
                ? userOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].createdAt 
                : null;
            const refundCount = userOrders.filter(o => o.paymentStatus === 'refunded').length;
            const complaintCount = userTickets.length;

            return {
                ...user,
                totalOrders,
                totalSpent,
                avgOrderValue,
                lastOrderDate,
                refundCount,
                complaintCount
            };
        });

        res.json({
            users: enrichedUsers,
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

        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        
        const [analytics, monthlyStats, pendingCount, approvedThisMonth, rejectedThisMonth, allApproved] = await Promise.all([
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
                    dailyCapacity: true,
                    currentLoad: true,
                    commissionRate: true
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
                v.vendorProfile = { 
                    ...v.vendorProfile, 
                    ...(stats || {}),
                    revenueThisMonth: mStats?._sum?.grossAmount || 0,
                    ordersThisMonth: mStats?._sum?.orderCount || 0
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

        // Get order counts for top vendors from settlements
        const topVendors = await Promise.all(topVendorsProfiles.map(async (p) => {
            const orders = await prisma.vendorSettlement.aggregate({
                where: { vendorId: p.userId },
                _sum: { orderCount: true }
            });
            return {
                id: p.userId,
                name: p.businessName || p.user.name,
                image: p.user.image,
                revenue: p.totalRevenue,
                orders: orders._sum.orderCount || 0,
                sla: p.slaScore,
                rating: p.rating
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
            const active = await prisma.user.count({
                where: { 
                    role: 'vendor', 
                    vendorProfile: { isApproved: true },
                    createdAt: { lte: m.end }
                }
            });
            return {
                month: m.name,
                registered,
                active
            };
        }));

        // --- 4. Analytics Aggregates ---
        const analytics = await prisma.vendorProfile.aggregate({
            _sum: {
                totalRevenue: true,
                commissionEarned: true,
                payoutPending: true
            },
            _avg: {
                slaScore: true,
                rating: true,
                issueRate: true
            }
        });

        res.json({
            totalUsers,
            activeUsers,
            totalVendors,
            approvedVendors,
            verificationPending: Math.max(0, verificationPending),
            rejectedVendors: blockedVendors,
            highRiskVendors: highRiskAlerts.length,
            totalRevenue: analytics._sum.totalRevenue || 0,
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
            topVendors,
            growthData
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
