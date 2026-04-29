const express = require('express');
const prisma = require('../utils/prisma');

const router = express.Router();

// Get all addresses for a user
router.get('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const addresses = await prisma.address.findMany({
            where: { userId },
            orderBy: { id: 'asc' }
        });
        res.json(addresses);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching addresses', error: error.message });
    }
});

// Add new address
router.post('/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { addressLine, lat, lng, type, phone, flat, street, landmark, city, zipCode } = req.body;

        // Construct full address line from components if provided
        let fullAddressLine = addressLine;
        if (!addressLine && (flat || street)) {
            fullAddressLine = [flat, street, landmark, city, zipCode].filter(Boolean).join(', ');
        }

        const address = await prisma.address.create({
            data: {
                userId,
                addressLine: fullAddressLine || 'New Address',
                lat: parseFloat(lat) || 0,
                lng: parseFloat(lng) || 0,
                type: type || 'home'
            }
        });
        res.status(201).json({ message: 'Address created', address });
    } catch (error) {
        res.status(500).json({ message: 'Error creating address', error: error.message });
    }
});

// Update address
router.put('/:addressId', async (req, res) => {
    try {
        const { addressId } = req.params;
        const { addressLine, lat, lng, type, phone, flat, street, landmark, city, zipCode } = req.body;

        let fullAddressLine = addressLine;
        if (!addressLine && (flat || street)) {
            fullAddressLine = [flat, street, landmark, city, zipCode].filter(Boolean).join(', ');
        }

        const address = await prisma.address.update({
            where: { id: addressId },
            data: {
                addressLine: fullAddressLine,
                lat: parseFloat(lat) || undefined,
                lng: parseFloat(lng) || undefined,
                type: type || undefined
            }
        });
        res.json({ message: 'Address updated', address });
    } catch (error) {
        res.status(500).json({ message: 'Error updating address', error: error.message });
    }
});

// Delete address
router.delete('/:addressId', async (req, res) => {
    try {
        const { addressId } = req.params;
        await prisma.address.delete({
            where: { id: addressId }
        });
        res.json({ message: 'Address deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting address', error: error.message });
    }
});

module.exports = router;
