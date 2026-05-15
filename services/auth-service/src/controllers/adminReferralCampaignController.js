const prisma = require('../utils/prisma');

const toNumber = (value, fallback = 0) => {
    if (value === undefined || value === null || value === '') return fallback;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error('Validation: Invalid numeric value in referral settings.');
    }
    return parsed;
};

const toOptionalNumber = (value, fallback = null) => {
    if (value === undefined) return fallback;
    if (value === null || value === '') return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
        throw new Error('Validation: Invalid numeric value in referral settings.');
    }
    return parsed;
};

const toOptionalDate = (value, fallback = null) => {
    if (value === undefined) return fallback;
    if (value === null || value === '') return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        throw new Error('Validation: Invalid date value in referral settings.');
    }
    return parsed;
};

const buildUsageStatsMap = async (campaignIds) => {
    const statsMap = new Map();
    if (!campaignIds.length) return statsMap;

    const redemptions = await prisma.referralRedemption.findMany({
        where: { campaignId: { in: campaignIds } },
        select: {
            campaignId: true,
            refereeUserId: true,
            status: true,
        },
    });

    redemptions.forEach((entry) => {
        if (!statsMap.has(entry.campaignId)) {
            statsMap.set(entry.campaignId, {
                redemptionsCount: 0,
                successfulRedemptionsCount: 0,
                uniqueRefereeUsers: new Set(),
            });
        }

        const stats = statsMap.get(entry.campaignId);
        stats.redemptionsCount += 1;
        if (entry.status === 'completed') {
            stats.successfulRedemptionsCount += 1;
        }
        stats.uniqueRefereeUsers.add(entry.refereeUserId);
    });

    return statsMap;
};

const withUsageStats = (campaign, statsMap) => {
    const stats = statsMap.get(campaign.id);
    return {
        ...campaign,
        usedByUsersCount: stats ? stats.uniqueRefereeUsers.size : 0,
        redemptionsCount: stats ? stats.redemptionsCount : 0,
        successfulRedemptionsCount: stats ? stats.successfulRedemptionsCount : 0,
    };
};

const buildCampaignCreateData = (payload, fallbackCampaign, adminId) => {
    const source = fallbackCampaign || {};
    return {
        title: payload.title ?? source.title ?? 'Referral Program',
        bannerTitle: payload.bannerTitle ?? source.bannerTitle ?? null,
        bannerSubtitle: payload.bannerSubtitle ?? source.bannerSubtitle ?? null,
        bannerImageUrl: payload.bannerImageUrl ?? source.bannerImageUrl ?? null,
        referrerRewardAmount: toNumber(
            payload.referrerRewardAmount,
            source.referrerRewardAmount ?? 0
        ),
        refereeRewardAmount: toNumber(
            payload.refereeRewardAmount,
            source.refereeRewardAmount ?? 0
        ),
        firstOrderRequired:
            payload.firstOrderRequired ?? source.firstOrderRequired ?? true,
        minimumCartValue: toNumber(
            payload.minimumCartValue,
            source.minimumCartValue ?? 0
        ),
        targetCityCodes: Array.isArray(payload.targetCityCodes)
            ? payload.targetCityCodes
            : Array.isArray(source.targetCityCodes)
                ? source.targetCityCodes
                : [],
        rewardExpiryDays: toNumber(
            payload.rewardExpiryDays,
            source.rewardExpiryDays ?? 30
        ),
        maxReferralsPerUser: toOptionalNumber(
            payload.maxReferralsPerUser,
            source.maxReferralsPerUser ?? null
        ),
        isActive: payload.isActive ?? source.isActive ?? true,
        startAt: toOptionalDate(payload.startAt, source.startAt ?? null),
        endAt: toOptionalDate(payload.endAt, source.endAt ?? null),
        createdByAdminId: adminId,
    };
};

const getAllCampaigns = async (req, res) => {
    try {
        const campaigns = await prisma.referralCampaign.findMany({
            orderBy: { createdAt: 'desc' }
        });

        const statsMap = await buildUsageStatsMap(campaigns.map((c) => c.id));
        res.json(campaigns.map((campaign) => withUsageStats(campaign, statsMap)));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createCampaign = async (req, res) => {
    try {
        const payload = req.body || {};
        const campaign = await prisma.referralCampaign.create({
            data: buildCampaignCreateData(payload, null, req.admin?.userId)
        });

        const statsMap = await buildUsageStatsMap([campaign.id]);
        res.status(201).json(withUsageStats(campaign, statsMap));
    } catch (error) {
        if (String(error.message || '').startsWith('Validation:')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
};

const updateCampaign = async (req, res) => {
    try {
        const { id } = req.params;

        const existingCampaign = await prisma.referralCampaign.findUnique({
            where: { id }
        });

        if (!existingCampaign) {
            return res.status(404).json({ error: 'Referral campaign not found' });
        }

        const payload = req.body || {};
        const newVersionData = buildCampaignCreateData(
            payload,
            existingCampaign,
            req.admin?.userId
        );

        // Requirement: every settings update should create a new referral ID.
        const [, newVersion] = await prisma.$transaction([
            prisma.referralCampaign.update({
                where: { id },
                data: {
                    isActive: false,
                    updatedByAdminId: req.admin?.userId,
                    endAt: existingCampaign.endAt || new Date(),
                },
            }),
            prisma.referralCampaign.create({
                data: {
                    ...newVersionData,
                    isActive: true,
                },
            }),
        ]);

        const statsMap = await buildUsageStatsMap([newVersion.id]);
        res.json({
            ...withUsageStats(newVersion, statsMap),
            replacedCampaignId: id,
        });
    } catch (error) {
        if (String(error.message || '').startsWith('Validation:')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
};

const deleteCampaign = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.referralCampaign.delete({ where: { id } });
        res.json({ message: 'Referral campaign deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getActiveCampaign = async (req, res) => {
    try {
        const campaign = await prisma.referralCampaign.findFirst({
            where: { isActive: true },
            orderBy: { createdAt: 'desc' }
        });
        if (!campaign) {
            return res.status(404).json({ error: 'No active referral campaign' });
        }
        res.json(campaign);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getAllCampaigns, createCampaign, updateCampaign, deleteCampaign, getActiveCampaign
};
