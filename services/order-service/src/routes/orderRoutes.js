const express = require('express');
const multer = require('multer');
const { createOrder, checkPrice, uploadImage, getCustomerOrders, getOrder, updateOrderStatus } = require('../controllers/orderController');
const path = require('path');

const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

router.post('/', createOrder);
router.post('/price-check', checkPrice);
router.post('/upload', upload.single('image'), uploadImage);

// Customer order management routes
router.get('/customer/:userId', getCustomerOrders);
router.get('/:id', getOrder);
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
