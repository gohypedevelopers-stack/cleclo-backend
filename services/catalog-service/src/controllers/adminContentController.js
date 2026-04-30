const prisma = require('../utils/prisma');

const USER_SEGMENTS = new Set(['new_users', 'repeat_users']);

function normalizeStringArray(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(
        value
            .map((item) => String(item || '').trim())
            .filter(Boolean)
    )];
}

function normalizeDate(value) {
    if (value === undefined) return undefined;
    if (value === null || value === '') return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new Error(`Invalid date value: ${value}`);
    }

    return date;
}

function normalizeNumber(value, fallback = 0) {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    return parsed;
}

function normalizeBannerPayload(payload, existing = {}) {
    const data = {
        title: payload.title === undefined ? existing.title : String(payload.title || '').trim(),
        subtitle: payload.subtitle === undefined ? existing.subtitle : String(payload.subtitle || '').trim() || null,
        ctaLabel: payload.ctaLabel === undefined ? existing.ctaLabel : String(payload.ctaLabel || '').trim() || null,
        ctaType: payload.ctaType === undefined ? existing.ctaType : String(payload.ctaType || '').trim() || null,
        ctaTargetId: payload.ctaTargetId === undefined ? existing.ctaTargetId : String(payload.ctaTargetId || '').trim() || null,
        ctaUrl: payload.ctaUrl === undefined ? existing.ctaUrl : String(payload.ctaUrl || '').trim() || null,
        imageUrl: payload.imageUrl === undefined ? existing.imageUrl : payload.imageUrl || null,
        isActive: payload.isActive === undefined ? existing.isActive ?? true : Boolean(payload.isActive),
        priorityRank: normalizeNumber(payload.priorityRank, existing.priorityRank || 0),
        targetCityCodes: payload.targetCityCodes === undefined ? existing.targetCityCodes || [] : normalizeStringArray(payload.targetCityCodes),
        targetVendorIds: payload.targetVendorIds === undefined ? existing.targetVendorIds || [] : normalizeStringArray(payload.targetVendorIds),
        targetUserSegments: payload.targetUserSegments === undefined
            ? existing.targetUserSegments || []
            : normalizeStringArray(payload.targetUserSegments).filter((segment) => USER_SEGMENTS.has(segment))
    };

    const startAt = normalizeDate(payload.startAt);
    const endAt = normalizeDate(payload.endAt);
    if (startAt !== undefined) data.startAt = startAt;
    if (endAt !== undefined) data.endAt = endAt;

    if (!data.title) {
        throw new Error('Banner title is required');
    }

    return data;
}

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
        const payload = normalizeBannerPayload(req.body);
        const banner = await prisma.homeBanner.create({
            data: {
                ...payload,
                createdByAdminId: req.admin?.userId,
                createdByAdminName: req.admin?.name || 'Admin'
            }
        });
        res.status(201).json(banner);
    } catch (error) {
        console.error("CREATE Banner Error:", error);
        res.status(400).json({ error: error.message });
    }
};

const updateBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const current = await prisma.homeBanner.findUnique({ where: { id } });
        if (!current) return res.status(404).json({ error: 'Banner not found' });

        const banner = await prisma.homeBanner.update({
            where: { id },
            data: {
                ...normalizeBannerPayload(req.body, current),
                updatedByAdminId: req.admin?.userId,
                updatedByAdminName: req.admin?.name || 'Admin'
            }
        });
        res.json(banner);
    } catch (error) {
        res.status(400).json({ error: error.message });
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
            select: {
                id: true,
                title: true,
                description: true,
                durationSeconds: true,
                isActive: true,
                thumbnailUrl: true,
                sortOrder: true,
                createdAt: true,
            },
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
        const data = { ...req.body, updatedByAdminId: req.admin?.userId };
        if (!data.videoUrl) {
            delete data.videoUrl;
        }
        const video = await prisma.homeVideo.update({
            where: { id },
            data
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
