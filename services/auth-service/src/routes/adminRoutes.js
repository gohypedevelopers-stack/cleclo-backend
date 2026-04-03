const express = require('express');
const adminController = require('../controllers/adminController');
const settlementController = require('../controllers/settlementController');
const { ADMIN_ROLES } = require('../config/adminAccess');
const { authenticateAdmin, authorizeAdminRoles } = require('../middleware/adminAuth');

const router = express.Router();

router.use(authenticateAdmin);

// ============================================
// DASHBOARD
// ============================================
router.get(
  '/dashboard/stats',
  authorizeAdminRoles(
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.OPERATIONS_ADMIN,
    ADMIN_ROLES.FINANCE_ADMIN
  ),
  adminController.getDashboardStats
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

// ============================================
// WALLET MANAGEMENT
// ============================================
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
  '/settlements/:id/paid',
  authorizeAdminRoles(ADMIN_ROLES.SUPER_ADMIN, ADMIN_ROLES.FINANCE_ADMIN),
  settlementController.markSettlementPaid
);

module.exports = router;
