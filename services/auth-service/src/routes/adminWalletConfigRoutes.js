const express = require('express');
const adminWalletConfigController = require('../controllers/adminWalletConfigController');
const { authenticateAdmin } = require('../middleware/adminAuth');

const router = express.Router();

router.use(authenticateAdmin);

router.get('/wallet-config', adminWalletConfigController.getPlatformConfig);
router.put('/wallet-config', adminWalletConfigController.updatePlatformConfig);

router.get('/wallet-reward-rules', adminWalletConfigController.getRewardRules);
router.post('/wallet-reward-rules', adminWalletConfigController.createRewardRule);
router.put('/wallet-reward-rules/:id', adminWalletConfigController.updateRewardRule);
router.delete('/wallet-reward-rules/:id', adminWalletConfigController.deleteRewardRule);

router.get('/wallet-liability/summary', adminWalletConfigController.getWalletLiabilitySummary);

module.exports = router;
