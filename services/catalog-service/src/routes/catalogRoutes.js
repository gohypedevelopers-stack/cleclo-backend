const express = require('express');
const { getServices, getInputData, getItemsByIds, resolveCatalogPricing } = require('../controllers/catalogController');

const router = express.Router();

router.get('/services', getServices);
router.get('/input-data', getInputData);
router.post('/items/bulk', getItemsByIds);
router.post('/pricing/resolve', resolveCatalogPricing);
router.get('/home-config', require('../controllers/publicContentController').getHomeConfig);

// Location routes
const locationController = require('../controllers/locationController');
router.get('/locations/cities', locationController.getCities);
router.get('/locations/time-slots', locationController.getTimeSlots);
router.post('/locations/validate', locationController.validateLocationAndSlot);

module.exports = router;
