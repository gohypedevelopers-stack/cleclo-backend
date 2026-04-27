const express = require('express');
const adminReferralCampaignController = require('../controllers/adminReferralCampaignController');
const { authenticateAdmin } = require('../middleware/adminAuth');

const router = express.Router();

router.use(authenticateAdmin);

router.get('/referral-campaigns', adminReferralCampaignController.getAllCampaigns);
router.post('/referral-campaigns', adminReferralCampaignController.createCampaign);
router.put('/referral-campaigns/:id', adminReferralCampaignController.updateCampaign);
router.delete('/referral-campaigns/:id', adminReferralCampaignController.deleteCampaign);

module.exports = router;
