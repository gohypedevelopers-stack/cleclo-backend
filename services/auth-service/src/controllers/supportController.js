const prisma = require('../utils/prisma');

// Create a new support ticket
const createTicket = async (req, res) => {
    try {
        const { userId, targetId, subject, category, message, priority } = req.body;

        if (!userId || !subject || !message) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate if target is valid vendor if provided
        if (targetId) {
            const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
            if (!targetUser || targetUser.role !== 'vendor') {
                return res.status(400).json({ error: 'Invalid target vendor' });
            }
        }

        const ticket = await prisma.supportTicket.create({
            data: {
                userId,
                targetId: targetId || null, // null = Admin
                subject,
                category: category || 'general',
                message,
                priority: priority || 'medium',
                status: 'open'
            }
        });

        res.status(201).json(ticket);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get tickets for a user (My Tickets) - Created by me OR Sent to me
const getUserTickets = async (req, res) => {
    try {
        const { userId, role } = req.query; // role: 'customer' or 'vendor'

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        let where = {};

        if (role === 'vendor') {
            // Vendors see tickets they created AND tickets assigned to them
            where = {
                OR: [
                    { userId: userId }, // Created by vendor (e.g. to admin)
                    { targetId: userId } // Sent to vendor (by customer)
                ]
            };
        } else {
            // Customers just see what they created
            where = { userId: userId };
        }

        const tickets = await prisma.supportTicket.findMany({
            where,
            include: {
                user: { select: { name: true, role: true } }, // Creator info
                target: { select: { name: true, businessName: true } } // Target info (if vendor)
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Get tickets for Admin (Unassigned + Escalated)
const getAdminTickets = async (req, res) => {
    try {
        const { status, category, isEscalated } = req.query;

        const where = {
            OR: [
                { targetId: null },       // Direct to Admin
                { isEscalated: true }     // Escalated from Vendor
            ]
        };

        if (status) where.status = status;
        if (category) where.category = category;
        if (isEscalated === 'true') where.isEscalated = true;

        const tickets = await prisma.supportTicket.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true, role: true } },
                target: { select: { name: true, vendorProfile: { select: { businessName: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(tickets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update ticket status
const updateTicketStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, isEscalated } = req.body;

        const data = {};
        if (status) {
            data.status = status;
            if (status === 'resolved' || status === 'closed') {
                data.resolvedAt = new Date();
            }
        }
        if (isEscalated !== undefined) data.isEscalated = isEscalated;

        const ticket = await prisma.supportTicket.update({
            where: { id },
            data
        });

        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createTicket,
    getUserTickets,
    getAdminTickets,
    updateTicketStatus
};
