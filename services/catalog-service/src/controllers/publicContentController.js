const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getHomeConfig = async (req, res) => {
    try {
        const { cityCode, vendorId, userSegment } = req.query;
        const now = new Date();

        // 1. Fetch Banners
        const banners = await prisma.homeBanner.findMany({
            where: {
                isActive: true,
                AND: [
                    { OR: [{ startAt: null }, { startAt: { lte: now } }] },
                    { OR: [{ endAt: null }, { endAt: { gte: now } }] }
                ],
                // Simple targeting filter
                OR: [
                    { targetCityCodes: { has: cityCode } },
                    { targetCityCodes: { isEmpty: true } }
                ]
            },
            orderBy: { priorityRank: 'desc' }
        });

        // 2. Fetch Videos
        const videos = await prisma.homeVideo.findMany({
            where: {
                isActive: true,
                AND: [
                    { OR: [{ startAt: null }, { startAt: { lte: now } }] },
                    { OR: [{ endAt: null }, { endAt: { gte: now } }] }
                ],
                OR: [
                    { targetCityCodes: { has: cityCode } },
                    { targetCityCodes: { isEmpty: true } }
                ]
            },
            orderBy: { sortOrder: 'asc' }
        });

        // 3. Fetch Campaigns
        const campaigns = await prisma.campaign.findMany({
            where: {
                isActive: true,
                AND: [
                    { OR: [{ startAt: null }, { startAt: { lte: now } }] },
                    { OR: [{ endAt: null }, { endAt: { gte: now } }] }
                ],
                OR: [
                    { targetCityCodes: { has: cityCode } },
                    { targetCityCodes: { isEmpty: true } }
                ]
            },
            orderBy: { priorityRank: 'desc' }
        });

        res.json({
            banners,
            videos,
            campaigns,
            cityCode
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getHomeConfig
};
