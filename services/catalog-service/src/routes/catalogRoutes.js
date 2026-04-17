const express = require('express');
const { getServices, getInputData, getItemsByIds, createService, createCategory, createItem } = require('../controllers/catalogController');

const router = express.Router();

router.get('/services', getServices);
router.get('/input-data', getInputData);
router.post('/items/bulk', getItemsByIds);

// Generic Admin routes for populating data (optional for now but good to have)
router.post('/services', createService);
router.post('/categories', createCategory);
router.post('/items', createItem);

module.exports = router;
