const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getCities = async (req, res) => {
    try {
        const cities = await prisma.city.findMany({
            where: { status: 'active' },
            select: {
                id: true,
                name: true,
                code: true,
                surcharge: true
            }
        });
        res.json(cities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getTimeSlots = async (req, res) => {
    try {
        const { cityCode } = req.query;
        const slots = await prisma.timeSlot.findMany({
            where: {
                isActive: true,
                OR: [
                    { cityCode: cityCode || 'all' },
                    { cityCode: 'all' }
                ]
            },
            orderBy: { startTime: 'asc' }
        });
        res.json(slots);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const validateLocationAndSlot = async (req, res) => {
    try {
        const { cityCode, areaName, pickupTime, slotId } = req.body;
        const now = new Date();
        const pickupDate = new Date(pickupTime);

        // 1. Validate City
        const city = await prisma.city.findFirst({
            where: { code: cityCode, status: 'active' }
        });
        if (!city) {
            return res.status(400).json({ valid: false, message: 'Invalid or inactive city' });
        }

        // 2. Validate Area (optional if provided)
        let areaSurcharge = 0;
        if (areaName) {
            const area = await prisma.area.findFirst({
                where: { cityCode, name: areaName, status: 'active' }
            });
            if (!area) {
                return res.status(400).json({ valid: false, message: 'Invalid or inactive area' });
            }
            areaSurcharge = area.surcharge;
        }

        // 3. Validate Slot
        const slot = await prisma.timeSlot.findFirst({
            where: {
                id: slotId,
                isActive: true,
                OR: [{ cityCode }, { cityCode: 'all' }]
            }
        });

        if (!slot) {
            return res.status(400).json({ valid: false, message: 'Invalid or inactive time slot' });
        }

        // Check if pickupTime matches slot (approximate check: hours/minutes)
        // In a real app, you'd check if pickupDate falls within the slot's range on that day.
        // For now, we assume the slotId is enough if the user selected it from the valid list.

        res.json({
            valid: true,
            citySurcharge: city.surcharge,
            areaSurcharge,
            slotSurcharge: slot.surcharge,
            slotType: slot.slotType,
            totalLocationSurcharge: city.surcharge + areaSurcharge + slot.surcharge
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getCities,
    getTimeSlots,
    validateLocationAndSlot
};
