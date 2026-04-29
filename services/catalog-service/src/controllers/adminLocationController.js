const prisma = require('../utils/prisma');

// ============================================
// CITY CONFIG CRUD
// ============================================

const getAllCities = async (req, res) => {
    try {
        const cities = await prisma.cityConfig.findMany({
            orderBy: { displayOrder: 'asc' }
        });
        res.json(cities);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createCity = async (req, res) => {
    try {
        const payload = req.body;
        const city = await prisma.cityConfig.create({
            data: {
                ...payload,
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
        const city = await prisma.cityConfig.update({
            where: { id },
            data: {
                ...req.body,
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

module.exports = {
    getAllCities, createCity, updateCity, deleteCity,
    getAllAreas, createArea, updateArea, deleteArea,
    getAllTimeSlots, createTimeSlot, updateTimeSlot, deleteTimeSlot
};
