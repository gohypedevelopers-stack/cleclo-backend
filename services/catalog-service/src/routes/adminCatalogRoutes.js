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
router.patch('/services/:id/status', adminCatalogController.updateService);
router.delete('/services/:id', adminCatalogController.deleteService);

// Categories CRUD
router.get('/categories', adminCatalogController.getAllCategories);
router.post('/categories', adminCatalogController.createCategory);
router.put('/categories/:id', adminCatalogController.updateCategory);
router.patch('/categories/:id/status', adminCatalogController.updateCategory);
router.delete('/categories/:id', adminCatalogController.deleteCategory);
router.patch('/categories/reorder', adminCatalogController.reorderCategories);

// SubCategories CRUD
router.get('/subcategories', adminCatalogController.getAllSubCategories);
router.post('/subcategories', adminCatalogController.createSubCategory);
router.put('/subcategories/:id', adminCatalogController.updateSubCategory);
router.patch('/subcategories/:id/status', adminCatalogController.updateSubCategory);
router.delete('/subcategories/:id', adminCatalogController.deleteSubCategory);

// Items CRUD
router.get('/items', adminCatalogController.getAllItems);
router.post('/items', adminCatalogController.createItem);
router.put('/items/:id', adminCatalogController.updateItem);
router.patch('/items/:id/status', adminCatalogController.updateItem);
router.delete('/items/:id', adminCatalogController.deleteItem);

// Bulk Operations
router.post('/items/bulk-upload', adminCatalogController.bulkUploadItems);
router.post('/items/bulk-price-update', adminCatalogController.bulkPriceUpdate);
router.post('/items/price-preview', adminCatalogController.pricePreview);
router.get('/items/price-overrides', adminCatalogController.getItemPriceOverrides);
router.post('/items/price-overrides', adminCatalogController.saveItemPriceOverrides);



module.exports = router;
