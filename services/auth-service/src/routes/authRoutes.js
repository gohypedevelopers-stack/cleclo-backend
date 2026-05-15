const express = require('express');
const { signup, login, verifyOtp, sendOtp } = require('../controllers/authController');
const adminAuthController = require('../controllers/adminAuthController');

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);
router.post('/admin/login', adminAuthController.loginAdmin);
router.post('/admin/verify-otp', adminAuthController.verifyAdminOtp);
router.post('/vendor/register', require('../controllers/authController').registerVendor);
router.patch('/profile/:userId', require('../controllers/authController').updateProfile);
router.get('/referral/active', require('../controllers/adminReferralCampaignController').getActiveCampaign);

module.exports = router;
