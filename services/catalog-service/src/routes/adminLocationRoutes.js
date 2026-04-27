const express = require('express');
const adminLocationController = require('../controllers/adminLocationController');
const { authenticateAdmin } = require('../middleware/adminAuth');

const router = express.Router();

router.use(authenticateAdmin);

// Cities
router.get('/cities', adminLocationController.getAllCities);
router.post('/cities', adminLocationController.createCity);
router.put('/cities/:id', adminLocationController.updateCity);
router.delete('/cities/:id', adminLocationController.deleteCity);

// Areas
router.get('/areas', adminLocationController.getAllAreas);
router.post('/areas', adminLocationController.createArea);
router.put('/areas/:id', adminLocationController.updateArea);
router.delete('/areas/:id', adminLocationController.deleteArea);

// Time Slots
router.get('/time-slots', adminLocationController.getAllTimeSlots);
router.post('/time-slots', adminLocationController.createTimeSlot);
router.put('/time-slots/:id', adminLocationController.updateTimeSlot);
router.delete('/time-slots/:id', adminLocationController.deleteTimeSlot);

module.exports = router;
