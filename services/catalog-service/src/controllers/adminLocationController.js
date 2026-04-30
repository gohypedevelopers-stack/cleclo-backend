const prisma = require('../utils/prisma');
const { INDIA_STATES, INDIA_CITIES_BY_STATE } = require('../data/indiaLocations');

function normalizeStateCode(value) {
    return String(value || '').trim().toUpperCase();
}

function findStateByCode(code) {
    return INDIA_STATES.find((state) => state.code === normalizeStateCode(code)) || null;
}

function mergeCities(configuredCities, staticCities, state) {
    const merged = new Map();

    staticCities.forEach((city) => {
        merged.set(city.code, {
            cityCode: city.code,
            cityName: city.name,
            code: city.code,
            name: city.name,
            stateCode: state.code,
            stateName: state.name,
            source: 'static'
        });
    });

    configuredCities.forEach((city) => {
        merged.set(city.cityCode, {
            id: city.id,
            cityCode: city.cityCode,
            cityName: city.cityName,
            code: city.cityCode,
            name: city.cityName,
            stateCode: city.stateCode || state.code,
            stateName: city.stateName || state.name,
            isEnabled: city.isEnabled,
            source: 'configured'
        });
    });

    return Array.from(merged.values()).sort((a, b) => a.cityName.localeCompare(b.cityName));
}

// ============================================
// CITY CONFIG CRUD
// ============================================

const getAllCities = async (req, res) => {
    try {
        const { stateCode } = req.query;
        const where = {};
        if (stateCode) where.stateCode = normalizeStateCode(stateCode);

        const cities = await prisma.cityConfig.findMany({
            where,
            orderBy: [{ displayOrder: 'asc' }, { cityName: 'asc' }]
        });
        res.json(cities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createCity = async (req, res) => {
    try {
        const payload = req.body;
        const stateCode = normalizeStateCode(payload.stateCode);
        const state = findStateByCode(stateCode);
        const city = await prisma.cityConfig.create({
            data: {
                ...payload,
                stateCode: stateCode || payload.stateCode || null,
                stateName: payload.stateName || state?.name || null,
                createdByAdminId: req.admin?.userId,
                createdByAdminName: req.admin?.name || 'Admin'
            }
        });
        res.status(201).json(city);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateCity = async (req, res) => {
    try {
        const { id } = req.params;
        const payload = req.body;
        const stateCode = normalizeStateCode(payload.stateCode);
        const state = findStateByCode(stateCode);
        const city = await prisma.cityConfig.update({
            where: { id },
            data: {
                ...payload,
                ...(payload.stateCode !== undefined ? { stateCode: stateCode || null } : {}),
                ...(payload.stateName !== undefined || payload.stateCode !== undefined
                    ? { stateName: payload.stateName || state?.name || null }
                    : {}),
                updatedByAdminId: req.admin?.userId,
                updatedByAdminName: req.admin?.name || 'Admin'
            }
        });
        res.json(city);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteCity = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.cityConfig.delete({ where: { id } });
        res.json({ message: 'City deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// AREA CONFIG CRUD
// ============================================

const getAllAreas = async (req, res) => {
    try {
        const { cityCode } = req.query;
        const where = cityCode ? { cityCode } : {};
        const areas = await prisma.areaConfig.findMany({
            where,
            orderBy: { areaName: 'asc' }
        });
        res.json(areas);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createArea = async (req, res) => {
    try {
        const payload = req.body;
        const area = await prisma.areaConfig.create({
            data: {
                ...payload,
                createdByAdminId: req.admin?.userId,
                createdByAdminName: req.admin?.name || 'Admin'
            }
        });
        res.status(201).json(area);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateArea = async (req, res) => {
    try {
        const { id } = req.params;
        const area = await prisma.areaConfig.update({
            where: { id },
            data: {
                ...req.body,
                updatedByAdminId: req.admin?.userId,
                updatedByAdminName: req.admin?.name || 'Admin'
            }
        });
        res.json(area);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteArea = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.areaConfig.delete({ where: { id } });
        res.json({ message: 'Area deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// TIME SLOT CONFIG CRUD
// ============================================

const getAllTimeSlots = async (req, res) => {
    try {
        const { cityCode, slotType } = req.query;
        const where = {};
        if (cityCode) where.cityCode = cityCode;
        if (slotType) where.slotType = slotType;

        const slots = await prisma.timeSlotConfig.findMany({
            where,
            orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }]
        });
        res.json(slots);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createTimeSlot = async (req, res) => {
    try {
        const payload = req.body;
        const slot = await prisma.timeSlotConfig.create({
            data: {
                ...payload,
                createdByAdminId: req.admin?.userId,
                createdByAdminName: req.admin?.name || 'Admin'
            }
        });
        res.status(201).json(slot);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateTimeSlot = async (req, res) => {
    try {
        const { id } = req.params;
        const slot = await prisma.timeSlotConfig.update({
            where: { id },
            data: {
                ...req.body,
                updatedByAdminId: req.admin?.userId,
                updatedByAdminName: req.admin?.name || 'Admin'
            }
        });
        res.json(slot);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteTimeSlot = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.timeSlotConfig.delete({ where: { id } });
        res.json({ message: 'Time slot deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// STATE / CITY OPTION LOOKUPS
// ============================================

const getAllStates = async (req, res) => {
    try {
        const configuredCounts = await prisma.cityConfig.groupBy({
            by: ['stateCode'],
            _count: { cityCode: true },
            where: { stateCode: { not: null } }
        });
        const countByState = new Map(configuredCounts.map((item) => [item.stateCode, item._count.cityCode]));

        res.json(INDIA_STATES.map((state) => ({
            ...state,
            configuredCityCount: countByState.get(state.code) || 0
        })));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getCitiesByState = async (req, res) => {
    try {
        const stateCode = normalizeStateCode(req.params.stateCode || req.query.stateCode);
        const state = findStateByCode(stateCode);

        if (!state) {
            return res.status(400).json({ error: 'Invalid state code' });
        }

        const configuredCities = await prisma.cityConfig.findMany({
            where: { stateCode },
            orderBy: [{ displayOrder: 'asc' }, { cityName: 'asc' }]
        });

        res.json(mergeCities(configuredCities, INDIA_CITIES_BY_STATE[stateCode] || [], state));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllCities, createCity, updateCity, deleteCity,
    getAllAreas, createArea, updateArea, deleteArea,
    getAllTimeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot,
    getAllStates, getCitiesByState
};
