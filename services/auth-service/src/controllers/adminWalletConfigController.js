const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ============================================
// WALLET PLATFORM CONFIG
// ============================================

const getPlatformConfig = async (req, res) => {
    try {
        let config = await prisma.walletPlatformConfig.findFirst();
        if (!config) {
            config = await prisma.walletPlatformConfig.create({
                data: {
                    minAddAmount: 100,
                    maxAddAmount: 10000,
                    bonusEnabled: true,
                }
            });
        }
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updatePlatformConfig = async (req, res) => {
    try {
        const { minAddAmount, maxAddAmount, bonusEnabled } = req.body;
        let config = await prisma.walletPlatformConfig.findFirst();
        
        if (!config) {
            config = await prisma.walletPlatformConfig.create({
                data: { 
                    minAddAmount, 
                    maxAddAmount, 
                    bonusEnabled, 
                    updatedByAdminId: req.admin?.userId 
                }
            });
        } else {
            config = await prisma.walletPlatformConfig.update({
                where: { id: config.id },
                data: { 
                    minAddAmount, 
                    maxAddAmount, 
                    bonusEnabled, 
                    updatedByAdminId: req.admin?.userId 
                }
            });
        }
        
        res.json(config);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ============================================
// REWARD RULES
// ============================================

const getRewardRules = async (req, res) => {
    try {
        const rules = await prisma.walletRewardRule.findMany({
            orderBy: { priorityRank: 'desc' }
        });
        res.json(rules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createRewardRule = async (req, res) => {
    try {
        const payload = req.body;
        const rule = await prisma.walletRewardRule.create({
            data: { ...payload, createdByAdminId: req.admin?.userId }
        });
        res.status(201).json(rule);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const updateRewardRule = async (req, res) => {
    try {
        const { id } = req.params;
        const rule = await prisma.walletRewardRule.update({
            where: { id },
            data: { ...req.body, updatedByAdminId: req.admin?.userId }
        });
        res.json(rule);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const deleteRewardRule = async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.walletRewardRule.delete({ where: { id } });
        res.json({ message: 'Reward rule deleted' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getPlatformConfig, updatePlatformConfig,
    getRewardRules, createRewardRule, updateRewardRule, deleteRewardRule
};
