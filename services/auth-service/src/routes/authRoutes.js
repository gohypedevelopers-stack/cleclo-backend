const express = require('express');
const { signup, login, verifyOtp } = require('../controllers/authController');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/verify-otp', verifyOtp);
router.post('/vendor/register', require('../controllers/authController').registerVendor);
router.patch('/profile/:userId', require('../controllers/authController').updateProfile);

module.exports = router;
