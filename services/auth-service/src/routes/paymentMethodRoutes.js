const express = require('express');
const prisma = require('../utils/prisma');

const router = express.Router();

// Get all payment methods for a user
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const methods = await prisma.paymentMethod.findMany({
            where: { userId },
            orderBy: [
                { isDefault: 'desc' },
                { createdAt: 'desc' }
            ]
        });
        res.json(methods);
    } catch (error) {
        console.error('Get payment methods error:', error);
        res.status(500).json({ error: 'Failed to fetch payment methods' });
    }
});

// Add a new payment method (card or UPI)
router.post('/', async (req, res) => {
    try {
        const { userId, type, cardType, lastFour, cardHolderName, expiryMonth, expiryYear, upiId, isDefault } = req.body;

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        // If setting as default, unset other defaults first
        if (isDefault) {
            await prisma.paymentMethod.updateMany({
                where: { userId },
                data: { isDefault: false }
            });
        }

        const method = await prisma.paymentMethod.create({
            data: {
                userId,
                type: type || 'card',
                cardType,
                lastFour,
                cardHolderName,
                expiryMonth,
                expiryYear,
                upiId,
                isDefault: isDefault || false,
            }
        });

        res.status(201).json(method);
    } catch (error) {
        console.error('Add payment method error:', error);
        res.status(500).json({ error: 'Failed to add payment method' });
    }
});

// Update a payment method
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { isDefault, cardHolderName, expiryMonth, expiryYear, upiId } = req.body;

        // Get the method to find userId
        const existing = await prisma.paymentMethod.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Payment method not found' });
        }

        // If setting as default, unset other defaults first
        if (isDefault) {
            await prisma.paymentMethod.updateMany({
                where: { userId: existing.userId },
                data: { isDefault: false }
            });
        }

        const method = await prisma.paymentMethod.update({
            where: { id },
            data: {
                isDefault,
                cardHolderName,
                expiryMonth,
                expiryYear,
                upiId,
            }
        });

        res.json(method);
    } catch (error) {
        console.error('Update payment method error:', error);
        res.status(500).json({ error: 'Failed to update payment method' });
    }
});

// Delete a payment method
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.paymentMethod.delete({ where: { id } });
        res.json({ message: 'Payment method deleted' });
    } catch (error) {
        console.error('Delete payment method error:', error);
        res.status(500).json({ error: 'Failed to delete payment method' });
    }
});

// Set as default
router.post('/:id/default', async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await prisma.paymentMethod.findUnique({ where: { id } });
        if (!existing) {
            return res.status(404).json({ error: 'Payment method not found' });
        }

        // Unset all defaults for this user
        await prisma.paymentMethod.updateMany({
            where: { userId: existing.userId },
            data: { isDefault: false }
        });

        // Set this one as default
        const method = await prisma.paymentMethod.update({
            where: { id },
            data: { isDefault: true }
        });

        res.json(method);
    } catch (error) {
        console.error('Set default error:', error);
        res.status(500).json({ error: 'Failed to set default' });
    }
});

module.exports = router;
