const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================
// BANNERS CRUD
// ============================================

const getAllBanners = async (req, res) => {
    try {
        const banners = await prisma.homeBanner.findMany({
            orderBy: { priorityRank: 'desc' }
        });
        res.json(banners);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createBanner = async (req, res) => {
    try {
        const payload = req.body;
        const banner = await prisma.homeBanner.create({
            data: {
                ...payload,
                isActive: payload.isActive !== undefined ? payload.isActive : true,
                priorityRank: payload.priorityRank || 0,
                createdByAdminId: req.admin?.userId
            }
        });
        res.status(201).json(banner);
    } catch (error) {
        console.error("CREATE Banner Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const updateBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await prisma.homeBanner.update({
            where: { id },
            data: { ...req.body, updatedByAdminId: req.admin?.userId }
        });
        res.json(banner);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.homeBanner.delete({ where: { id } });
        res.json({ message: 'Banner deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// VIDEOS CRUD
// ============================================

const getAllVideos = async (req, res) => {
    try {
        const videos = await prisma.homeVideo.findMany({
            orderBy: { sortOrder: 'asc' }
        });
        res.json(videos);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createVideo = async (req, res) => {
    try {
        const payload = req.body;
        const video = await prisma.homeVideo.create({
            data: {
                ...payload,
                sortOrder: payload.sortOrder || 0,
                isActive: payload.isActive !== undefined ? payload.isActive : true,
                createdByAdminId: req.admin?.userId
            }
        });
        res.status(201).json(video);
    } catch (error) {
        console.error("CREATE Video Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const updateVideo = async (req, res) => {
    try {
        const { id } = req.params;
        const video = await prisma.homeVideo.update({
            where: { id },
            data: { ...req.body, updatedByAdminId: req.admin?.userId }
        });
        res.json(video);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteVideo = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.homeVideo.delete({ where: { id } });
        res.json({ message: 'Video deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// CAMPAIGNS CRUD
// ============================================

const getAllCampaigns = async (req, res) => {
    try {
        const campaigns = await prisma.campaign.findMany({
            orderBy: { priorityRank: 'desc' }
        });
        res.json(campaigns);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createCampaign = async (req, res) => {
    try {
        const payload = req.body;
        const campaign = await prisma.campaign.create({
            data: { ...payload, createdByAdminId: req.admin?.userId }
        });
        res.status(201).json(campaign);
    } catch (error) {
        console.error("CREATE Campaign Error:", error);
        res.status(500).json({ error: error.message });
    }
};

const updateCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        const campaign = await prisma.campaign.update({
            where: { id },
            data: { ...req.body, updatedByAdminId: req.admin?.userId }
        });
        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.campaign.delete({ where: { id } });
        res.json({ message: 'Campaign deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllBanners, createBanner, updateBanner, deleteBanner,
    getAllVideos, createVideo, updateVideo, deleteVideo,
    getAllCampaigns, createCampaign, updateCampaign, deleteCampaign
};
