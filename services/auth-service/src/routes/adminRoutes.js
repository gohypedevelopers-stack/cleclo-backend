const express = require('express');
const adminController = require('../controllers/adminController');
const adminInsightsController = require('../controllers/adminInsightsController');
const settlementController = require('../controllers/settlementController');
const { ADMIN_ROLES } = require('../config/adminAccess');
const { authenticateAdmin, authorizeAdminRoles } = require('../middleware/adminAuth');

const {
  getDashboardOverviewHandler,
  getIssueAlertsHandler,
  markAllIssuesReviewedHandler,
  updateIssueAlertHandler,
  getVendorWeeklyActivityHandler
} = adminInsightsController;

const {
  loginAdmin,
  verifyAdminOtp,
  changeAdminPassword,
  updateAdminProfile
} = require('../controllers/adminAuthController');

const router = express.Router();

// Public/Internal routes (accessible without admin token)
router.post('/users/by-ids', adminController.getUsersByIds);
router.get('/users/search', adminController.getAllUsers); // Allow internal search

router.use(authenticateAdmin);

// ============================================
// DASHBOARD
// ============================================
router.get(
  '/dashboard/overview',
  authorizeAdminRoles(
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.OPERATIONS_ADMIN,
    ADMIN_ROLES.FINANCE_ADMIN
  ),
  adminInsightsController.getDashboardOverviewHandler
);
router.get(
  '/dashboard/stats',
  authorizeAdminRoles(
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.OPERATIONS_ADMIN,
    ADMIN_ROLES.FINANCE_ADMIN
  ),
  adminController.getDashboardStats
);
router.get(
  '/notifications',
  authorizeAdminRoles(
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.OPERATIONS_ADMIN,
    ADMIN_ROLES.FINANCE_ADMIN
  ),
  adminController.getNotifications
);
router.get(
  '/vendors/weekly-activity',
  authorizeAdminRoles(
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.OPERATIONS_ADMIN,
    ADMIN_ROLES.FINANCE_ADMIN
  ),
  getVendorWeeklyActivityHandler
);

// ============================================
// ISSUE ALERTS
// ============================================
router.get(
  '/issues',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminInsightsController.getIssueAlertsHandler
);
router.post(
  '/issues/review-all',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminInsightsController.markAllIssuesReviewedHandler
);
router.patch(
  '/issues/:issueId',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminInsightsController.updateIssueAlertHandler
);

// ============================================
// USER MANAGEMENT
// ============================================
router.get(
  '/users',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminController.getAllUsers
);
router.get(
  '/users/:id',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminController.getUserById
);
router.put(
  '/users/:id',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminController.updateUser
);
router.patch(
  '/users/:id/block',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminController.blockUser
);
router.get(
  '/users/:id/addresses',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminController.getUserAddresses
);
router.post(
  '/users/:id/reset-password',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminController.resetPassword
);

// ============================================
// WALLET MANAGEMENT
// ============================================
const adminWalletConfigController = require('../controllers/adminWalletConfigController');

router.get(
  '/users/:id/wallet',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN),
  adminController.getUserWallet
);
router.post(
  '/users/:id/wallet',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN),
  adminController.adjustWallet
);

// ============================================
// LOYALTY MANAGEMENT
// ============================================
router.post(
  '/users/:id/loyalty/adjust',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminController.adjustLoyaltyPoints
);

// Wallet Config
router.get('/wallet/config', authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN), adminWalletConfigController.getPlatformConfig);
router.put('/wallet/config', authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN), adminWalletConfigController.updatePlatformConfig);

// Reward Rules
router.get('/wallet/rewards', authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN), adminWalletConfigController.getRewardRules);
router.post('/wallet/rewards', authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN), adminWalletConfigController.createRewardRule);
router.put('/wallet/rewards/:id', authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN), adminWalletConfigController.updateRewardRule);
router.delete('/wallet/rewards/:id', authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN), adminWalletConfigController.deleteRewardRule);

// ============================================
// REFERRAL CAMPAIGNS
// ============================================
const adminReferralController = require('../controllers/adminReferralCampaignController');

router.get('/referrals/campaigns', authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN), adminReferralController.getAllCampaigns);
router.post('/referrals/campaigns', authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN), adminReferralController.createCampaign);
router.put('/referrals/campaigns/:id', authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN), adminReferralController.updateCampaign);
router.delete('/referrals/campaigns/:id', authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN), adminReferralController.deleteCampaign);

// ============================================
// VENDOR MANAGEMENT
// ============================================
router.get(
  '/vendors',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminController.getAllVendors
);
router.get(
  '/vendors/pending',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminController.getPendingVendors
);
router.get(
  '/vendors/:id',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN, ADMIN_ROLES.FINANCE_ADMIN),
  adminController.getVendorById
);
router.put(
  '/vendors/:id',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminController.updateVendor
);
router.patch(
  '/vendors/:vendorId/approve',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminController.approveVendor
);
router.patch(
  '/vendors/:id/suspend',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.OPERATIONS_ADMIN),
  adminController.suspendVendor
);
router.get(
  '/vendors/:id/payouts',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN),
  adminController.getVendorPayouts
);

// ============================================
// SETTLEMENTS / FINANCE
// ============================================
router.get(
  '/settlements',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN),
  settlementController.getAllSettlements
);
router.get(
  '/settlements/stats',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN),
  settlementController.getSettlementStats
);
router.post(
  '/settlements',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN),
  settlementController.createSettlement
);
router.patch(
  '/settlements/:id',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN),
  settlementController.updateSettlement
);
router.patch(
  '/settlements/:id/paid',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN),
  settlementController.markSettlementPaid
);

// ============================================
// ADMIN ACCOUNT SECURITY
// ============================================
router.post(
  '/auth/change-password',
  authorizeAdminRoles(
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.OPERATIONS_ADMIN,
    ADMIN_ROLES.FINANCE_ADMIN
  ),
  changeAdminPassword
);
router.patch(
  '/auth/update-profile',
  authorizeAdminRoles(
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.OPERATIONS_ADMIN,
    ADMIN_ROLES.FINANCE_ADMIN
  ),
  updateAdminProfile
);

module.exports = router;
