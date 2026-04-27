const express = require('express');
const adminContentController = require('../controllers/adminContentController');
const { authenticateAdmin } = require('../middleware/adminAuth');

const router = express.Router();

router.use(authenticateAdmin);

// Banners
router.get('/banners', adminContentController.getAllBanners);
router.post('/banners', adminContentController.createBanner);
router.put('/banners/:id', adminContentController.updateBanner);
router.delete('/banners/:id', adminContentController.deleteBanner);

// Videos
router.get('/videos', adminContentController.getAllVideos);
router.post('/videos', adminContentController.createVideo);
router.put('/videos/:id', adminContentController.updateVideo);
router.delete('/videos/:id', adminContentController.deleteVideo);

// Campaigns
router.get('/campaigns', adminContentController.getAllCampaigns);
router.post('/campaigns', adminContentController.createCampaign);
router.put('/campaigns/:id', adminContentController.updateCampaign);
router.delete('/campaigns/:id', adminContentController.deleteCampaign);

module.exports = router;
