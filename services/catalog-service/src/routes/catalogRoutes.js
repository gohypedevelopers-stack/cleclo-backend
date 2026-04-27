const express = require('express');
const { getServices, getInputData, getItemsByIds, createService, createCategory, createItem } = require('../controllers/catalogController');

const router = express.Router();

router.get('/services', getServices);
router.get('/input-data', getInputData);
router.post('/items/bulk', getItemsByIds);
router.get('/home-config', require('../controllers/publicContentController').getHomeConfig);

// Location routes
const locationController = require('../controllers/locationController');
router.get('/locations/cities', locationController.getCities);
router.get('/locations/time-slots', locationController.getTimeSlots);
router.post('/locations/validate', locationController.validateLocationAndSlot);

// Generic Admin routes for populating data (optional for now but good to have)
router.post('/services', createService);
router.post('/categories', createCategory);
router.post('/items', createItem);

module.exports = router;
