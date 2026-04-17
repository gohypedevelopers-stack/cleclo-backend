const express = require('express');
const adminCatalogController = require('../controllers/adminCatalogController');
const { authenticateAdmin } = require('../middleware/adminAuth');

const router = express.Router();

// Middleware to check admin role
router.use(authenticateAdmin);

// Services CRUD
router.get('/services', adminCatalogController.getAllServices);
router.post('/services', adminCatalogController.createService);
router.put('/services/:id', adminCatalogController.updateService);
router.delete('/services/:id', adminCatalogController.deleteService);

// Categories CRUD
router.get('/categories', adminCatalogController.getAllCategories);
router.post('/categories', adminCatalogController.createCategory);
router.put('/categories/:id', adminCatalogController.updateCategory);
router.delete('/categories/:id', adminCatalogController.deleteCategory);
router.patch('/categories/reorder', adminCatalogController.reorderCategories);

// SubCategories CRUD
router.get('/subcategories', adminCatalogController.getAllSubCategories);
router.post('/subcategories', adminCatalogController.createSubCategory);
router.put('/subcategories/:id', adminCatalogController.updateSubCategory);
router.delete('/subcategories/:id', adminCatalogController.deleteSubCategory);

// Items CRUD
router.get('/items', adminCatalogController.getAllItems);
router.post('/items', adminCatalogController.createItem);
router.put('/items/:id', adminCatalogController.updateItem);
router.delete('/items/:id', adminCatalogController.deleteItem);

// Content Banners
const adminContentController = require('../controllers/adminContentController');

router.get('/banners', adminContentController.getAllBanners);
router.post('/banners', adminContentController.createBanner);
router.put('/banners/:id', adminContentController.updateBanner);
router.delete('/banners/:id', adminContentController.deleteBanner);

// Content Videos
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
