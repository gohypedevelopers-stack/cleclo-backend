const prisma = require('../utils/prisma');

function targetingWhere({ cityCode, vendorId, userSegment }) {
    const clauses = [];

    clauses.push(cityCode
        ? { OR: [{ targetCityCodes: { has: cityCode } }, { targetCityCodes: { isEmpty: true } }] }
        : { targetCityCodes: { isEmpty: true } });

    clauses.push(vendorId
        ? { OR: [{ targetVendorIds: { has: vendorId } }, { targetVendorIds: { isEmpty: true } }] }
        : { targetVendorIds: { isEmpty: true } });

    clauses.push(userSegment
        ? { OR: [{ targetUserSegments: { has: userSegment } }, { targetUserSegments: { isEmpty: true } }] }
        : { targetUserSegments: { isEmpty: true } });

    return clauses;
}

function activeWindowWhere(now) {
    return [
        { OR: [{ startAt: null }, { startAt: { lte: now } }] },
        { OR: [{ endAt: null }, { endAt: { gte: now } }] }
    ];
}

const getHomeConfig = async (req, res) => {
    try {
        const { cityCode, vendorId, userSegment } = req.query;
        const now = new Date();
        const targetClauses = targetingWhere({ cityCode, vendorId, userSegment });

        // 1. Fetch Banners
        const banners = await prisma.homeBanner.findMany({
            where: {
                isActive: true,
                AND: [
                    ...activeWindowWhere(now),
                    ...targetClauses
                ]
            },
            orderBy: { priorityRank: 'desc' }
        });

        // 2. Fetch Videos
        const videos = await prisma.homeVideo.findMany({
            where: {
                isActive: true,
                AND: [
                    ...activeWindowWhere(now),
                    ...targetClauses
                ]
            },
            orderBy: { sortOrder: 'asc' }
        });

        // 3. Fetch Campaigns
        const campaigns = await prisma.campaign.findMany({
            where: {
                isActive: true,
                AND: [
                    ...activeWindowWhere(now),
                    ...targetClauses
                ]
            },
            orderBy: { priorityRank: 'desc' }
        });

        res.json({
            banners,
            videos,
            campaigns,
            cityCode,
            vendorId,
            userSegment
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getHomeConfig
};
