const prisma = require('../utils/prisma');

function toPublicCity(city) {
    return {
        id: city.id,
        cityName: city.cityName,
        cityCode: city.cityCode,
        name: city.cityName,
        code: city.cityCode,
        timezone: city.timezone,
        displayOrder: city.displayOrder,
        isEnabled: city.isEnabled,
        status: city.isEnabled ? 'active' : 'inactive',
        surcharge: 0
    };
}

function toPublicSlot(slot) {
    return {
        ...slot,
        surcharge: 0
    };
}

function getTimeValue(date) {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function isPickupInsideSlot(pickupDate, slot) {
    if (Number.isNaN(pickupDate.getTime())) {
        return false;
    }

    const pickupDay = pickupDate.getDay();
    const pickupTime = getTimeValue(pickupDate);

    return slot.dayOfWeek === pickupDay && pickupTime >= slot.startTime && pickupTime <= slot.endTime;
}

function getResolvedSlaHours(slotType) {
    if (slotType === 'express') return 24;
    return 72;
}

const getCities = async (req, res) => {
    try {
        const cities = await prisma.cityConfig.findMany({
            where: { isEnabled: true },
            orderBy: { displayOrder: 'asc' }
        });
        res.json(cities.map(toPublicCity));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getTimeSlots = async (req, res) => {
    try {
        const { cityCode, slotType } = req.query;
        const where = {
            isActive: true
        };

        if (cityCode) {
            where.OR = [
                { cityCode },
                { cityCode: 'all' }
            ];
        }

        if (slotType) {
            where.slotType = slotType;
        }

        const slots = await prisma.timeSlotConfig.findMany({
            where: {
                ...where
            },
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
        });
        res.json(slots.map(toPublicSlot));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const validateLocationAndSlot = async (req, res) => {
    try {
        const { cityCode, areaCode, areaName, pickupTime, slotId } = req.body;
        const pickupDate = new Date(pickupTime);

        if (!cityCode || !slotId || Number.isNaN(pickupDate.getTime())) {
            return res.status(400).json({
                valid: false,
                slotValid: false,
                serviceAvailable: false,
                message: 'cityCode, slotId, and a valid pickupTime are required'
            });
        }

        const city = await prisma.cityConfig.findFirst({
            where: { cityCode, isEnabled: true }
        });
        if (!city) {
            return res.status(400).json({
                valid: false,
                slotValid: false,
                serviceAvailable: false,
                message: 'Invalid or inactive city'
            });
        }

        let area = null;
        let surgePercent = 0;
        if (areaCode || areaName) {
            area = await prisma.areaConfig.findFirst({
                where: {
                    cityCode,
                    isEnabled: true,
                    OR: [
                        areaCode ? { areaCode } : undefined,
                        areaName ? { areaName } : undefined
                    ].filter(Boolean)
                }
            });
            if (!area) {
                return res.status(400).json({
                    valid: false,
                    slotValid: false,
                    serviceAvailable: false,
                    message: 'Invalid or inactive area'
                });
            }
            surgePercent = area.surgePercent || 0;
        }

        const slot = await prisma.timeSlotConfig.findFirst({
            where: {
                id: slotId,
                isActive: true,
                OR: [{ cityCode }, { cityCode: 'all' }]
            }
        });

        if (!slot) {
            return res.status(400).json({
                valid: false,
                slotValid: false,
                serviceAvailable: true,
                message: 'Invalid or inactive time slot'
            });
        }

        const slotValid = isPickupInsideSlot(pickupDate, slot);
        if (!slotValid) {
            return res.status(400).json({
                valid: false,
                slotValid,
                serviceAvailable: true,
                surgePercent,
                resolvedSlaHours: getResolvedSlaHours(slot.slotType),
                message: 'Pickup time does not fall within the selected time slot'
            });
        }

        res.json({
            valid: true,
            slotValid,
            serviceAvailable: true,
            cityCode: city.cityCode,
            cityName: city.cityName,
            areaCode: area?.areaCode || null,
            areaName: area?.areaName || null,
            surgePercent,
            resolvedSlaHours: getResolvedSlaHours(slot.slotType),
            citySurcharge: 0,
            areaSurcharge: 0,
            slotSurcharge: 0,
            slotType: slot.slotType,
            totalLocationSurcharge: 0
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
