const crypto = require('crypto');
const prisma = require('../utils/prisma');


const VALID_SETTLEMENT_STATUSES = new Set(['pending', 'processing', 'paid', 'failed']);

function getSettlementStatusValue(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'processing') return 'PROCESSING';
    if (normalized === 'paid') return 'PAID';
    if (normalized === 'failed') return 'FAILED';
    return 'PENDING';
}

function getSettlementStatusLabel(status) {
    const normalized = String(status || '').trim().toLowerCase();
    if (normalized === 'processing') return 'processing';
    if (normalized === 'paid') return 'paid';
    if (normalized === 'failed') return 'failed';
    return 'pending';
}

function buildSettlementReference(id) {
    return `SETTLE-${String(id || '').replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function deriveCity(vendor) {
    const outletAddress = vendor?.outlets?.[0]?.address;
    const userAddress = vendor?.addresses?.[0]?.addressLine;
    const address = outletAddress || userAddress;
    if (!address) return 'Unknown';

    const parts = String(address)
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

    return parts[parts.length - 1] || 'Unknown';
}

function formatPeriodLabel(periodStart, periodEnd, createdAt) {
    if (!periodStart && !periodEnd) {
        return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(createdAt));
    }

    const formatter = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });
    if (periodStart && periodEnd) {
        return `${formatter.format(new Date(periodStart))} - ${formatter.format(new Date(periodEnd))}`;
    }

    return formatter.format(new Date(periodStart || periodEnd));
}

function formatSettlement(settlement) {
    const vendor = settlement.vendor || null;

    return {
        id: settlement.id,
        vendorId: settlement.vendorId,
        vendor:
            vendor?.vendorProfile?.businessName ||
            vendor?.name ||
            `Vendor ${String(settlement.vendorId || '').slice(0, 8)}`,
        vendorPhone: vendor?.phone || 'N/A',
        city: deriveCity(vendor),
        amount: Number(settlement.amount || 0),
        grossAmount: Number(settlement.grossAmount || settlement.amount || 0),
        commissionAmount: Number(settlement.commissionAmount || 0),
        netPayoutAmount: Number(settlement.amount || 0),
        orderCount: Number(settlement.orderCount || 0),
        status: getSettlementStatusLabel(settlement.status),
        note: settlement.note || null,
        failureReason: settlement.failureReason || null,
        transactionReference: settlement.transactionReference || buildSettlementReference(settlement.id),
        periodStart: settlement.periodStart || null,
        periodEnd: settlement.periodEnd || null,
        periodLabel: formatPeriodLabel(settlement.periodStart, settlement.periodEnd, settlement.createdAt),
        processedAt: settlement.processedAt || null,
        paidAt: settlement.paidAt || null,
        failedAt: settlement.failedAt || null,
        createdAt: settlement.createdAt,
        updatedAt: settlement.updatedAt || settlement.createdAt
    };
}

function validateMoneyField(value, fieldName) {
    if (value == null) return null;
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
        return `${fieldName} must be a non-negative number`;
    }
    return null;
}

async function getAllSettlements(req, res) {
    try {
        const { status, vendorId, search } = req.query;
        const where = {};

        if (status && VALID_SETTLEMENT_STATUSES.has(status)) {
            where.status = getSettlementStatusValue(status);
        }
        if (vendorId) {
            where.vendorId = vendorId;
        }
        if (search) {
            where.OR = [
                { id: { contains: search, mode: 'insensitive' } },
                { transactionReference: { contains: search, mode: 'insensitive' } },
                {
                    vendor: {
                        is: {
                            OR: [
                                { name: { contains: search, mode: 'insensitive' } },
                                { phone: { contains: search, mode: 'insensitive' } },
                                {
                                    vendorProfile: {
                                        is: {
                                            businessName: { contains: search, mode: 'insensitive' }
                                        }
                                    }
                                }
                            ]
                        }
                    }
                }
            ];
        }

        const settlements = await prisma.vendorSettlement.findMany({
            where,
            include: {
                vendor: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        addresses: { select: { addressLine: true } },
                        outlets: { select: { address: true } },
                        vendorProfile: { select: { businessName: true, commissionRate: true } }
                    }
                }
            },
            orderBy: [{ createdAt: 'desc' }]
        });

        res.json(settlements.map(formatSettlement));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function createSettlement(req, res) {
    try {
        const {
            vendorId,
            amount,
            note,
            grossAmount,
            commissionAmount,
            orderCount,
            periodStart,
            periodEnd,
            transactionReference
        } = req.body;

        if (!vendorId) {
            return res.status(400).json({ error: 'vendorId is required' });
        }

        const vendor = await prisma.user.findUnique({
            where: { id: vendorId },
            select: { id: true, role: true }
        });
        if (!vendor || vendor.role !== 'vendor') {
            return res.status(404).json({ error: 'Vendor not found' });
        }

        const amountError = validateMoneyField(amount, 'amount');
        const grossAmountError = validateMoneyField(grossAmount, 'grossAmount');
        const commissionAmountError = validateMoneyField(commissionAmount, 'commissionAmount');
        if (amountError || grossAmountError || commissionAmountError) {
            return res.status(400).json({ error: amountError || grossAmountError || commissionAmountError });
        }

        if (periodStart && Number.isNaN(new Date(periodStart).getTime())) {
            return res.status(400).json({ error: 'periodStart must be a valid date' });
        }
        if (periodEnd && Number.isNaN(new Date(periodEnd).getTime())) {
            return res.status(400).json({ error: 'periodEnd must be a valid date' });
        }
        if (periodStart && periodEnd && new Date(periodStart) > new Date(periodEnd)) {
            return res.status(400).json({ error: 'periodEnd cannot be earlier than periodStart' });
        }

        const parsedOrderCount = Number(orderCount || 0);
        if (!Number.isInteger(parsedOrderCount) || parsedOrderCount < 0) {
            return res.status(400).json({ error: 'orderCount must be a non-negative integer' });
        }

        const settlementId = crypto.randomUUID();
        const settlement = await prisma.vendorSettlement.create({
            data: {
                id: settlementId,
                vendorId,
                amount: Number(amount),
                grossAmount: grossAmount == null ? Number(amount) : Number(grossAmount),
                commissionAmount: commissionAmount == null ? 0 : Number(commissionAmount),
                orderCount: parsedOrderCount,
                note: note || null,
                status: 'PENDING',
                periodStart: periodStart ? new Date(periodStart) : null,
                periodEnd: periodEnd ? new Date(periodEnd) : null,
                transactionReference: transactionReference || buildSettlementReference(settlementId)
            },
            include: {
                vendor: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        addresses: { select: { addressLine: true } },
                        outlets: { select: { address: true } },
                        vendorProfile: { select: { businessName: true, commissionRate: true } }
                    }
                }
            }
        });

        res.status(201).json({ message: 'Settlement created', settlement: formatSettlement(settlement) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function updateSettlement(req, res) {
    try {
        const { id } = req.params;
        const { status, note, failureReason, transactionReference } = req.body;

        if (status && !VALID_SETTLEMENT_STATUSES.has(status)) {
            return res.status(400).json({ error: 'Unsupported settlement status' });
        }

        const currentSettlement = await prisma.vendorSettlement.findUnique({
            where: { id },
            include: {
                vendor: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        addresses: { select: { addressLine: true } },
                        outlets: { select: { address: true } },
                        vendorProfile: { select: { businessName: true, commissionRate: true } }
                    }
                }
            }
        });

        if (!currentSettlement) {
            return res.status(404).json({ error: 'Settlement not found' });
        }

        const data = {};
        if (note !== undefined) data.note = note || null;
        if (transactionReference !== undefined) {
            data.transactionReference = transactionReference || buildSettlementReference(currentSettlement.id);
        }

        if (status) {
            data.status = getSettlementStatusValue(status);

            if (status === 'pending') {
                data.processedAt = null;
                data.failedAt = null;
                data.paidAt = null;
                data.failureReason = null;
            }

            if (status === 'processing') {
                data.processedAt = currentSettlement.processedAt || new Date();
                data.failedAt = null;
                data.failureReason = null;
            }

            if (status === 'paid') {
                data.processedAt = currentSettlement.processedAt || new Date();
                data.paidAt = new Date();
                data.failedAt = null;
                data.failureReason = null;
            }

            if (status === 'failed') {
                data.processedAt = currentSettlement.processedAt || new Date();
                data.failedAt = new Date();
                data.failureReason =
                    failureReason ||
                    currentSettlement.failureReason ||
                    currentSettlement.note ||
                    'Payout transfer failed';
            }
        } else if (failureReason !== undefined) {
            data.failureReason = failureReason || null;
        }

        const settlement = await prisma.vendorSettlement.update({
            where: { id },
            data,
            include: {
                vendor: {
                    select: {
                        id: true,
                        name: true,
                        phone: true,
                        addresses: { select: { addressLine: true } },
                        outlets: { select: { address: true } },
                        vendorProfile: { select: { businessName: true, commissionRate: true } }
                    }
                }
            }
        });

        res.json({ message: 'Settlement updated', settlement: formatSettlement(settlement) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function markSettlementPaid(req, res) {
    req.body.status = 'paid';
    return updateSettlement(req, res);
}

async function getSettlementStats(req, res) {
    try {
        const settlements = await prisma.vendorSettlement.findMany({
            select: {
                amount: true,
                commissionAmount: true,
                status: true
            }
        });

        const stats = {
            pending: { count: 0, amount: 0 },
            processing: { count: 0, amount: 0 },
            paid: { count: 0, amount: 0 },
            failed: { count: 0, amount: 0 },
            commissionsEarned: 0
        };

        settlements.forEach((settlement) => {
            const status = getSettlementStatusLabel(settlement.status);
            const amount = Number(settlement.amount || 0);

            if (stats[status]) {
                stats[status].count += 1;
                stats[status].amount += amount;
            }

            stats.commissionsEarned += Number(settlement.commissionAmount || 0);
        });

        const walletAgg = await prisma.wallet.aggregate({ _sum: { balance: true } });
        const totalCustomerWalletBalance = Number(walletAgg._sum.balance) || 0;

        res.json({
            ...stats,
            totalCustomerWalletBalance
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getAllSettlements,
    createSettlement,
    updateSettlement,
    markSettlementPaid,
    getSettlementStats
};
