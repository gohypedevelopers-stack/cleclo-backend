const express = require('express');
const adminOrderController = require('../controllers/adminOrderController');
const { ADMIN_ROLES, authenticateAdmin, authorizeAdminRoles } = require('../middleware/adminAuth');

const router = express.Router();

router.use(authenticateAdmin);

const allAdminRoles = [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.OPERATIONS_ADMIN,
    ADMIN_ROLES.FINANCE_ADMIN
];

const operationsRoles = [
    ADMIN_ROLES.SUPER_ADMIN,
    ADMIN_ROLES.OPERATIONS_ADMIN
];

// Dashboard
router.get('/dashboard/stats', authorizeAdminRoles(...allAdminRoles), adminOrderController.getDashboardStats);
router.get('/analytics', authorizeAdminRoles(...allAdminRoles), adminOrderController.getAnalyticsData);

// Orders
router.get('/', authorizeAdminRoles(...allAdminRoles), adminOrderController.getAllOrders);
router.get('/issues', authorizeAdminRoles(...operationsRoles), adminOrderController.getOrdersWithIssues);
router.get('/:id', authorizeAdminRoles(...allAdminRoles), adminOrderController.getOrderById);
router.patch('/:id/status', authorizeAdminRoles(...operationsRoles), adminOrderController.updateOrderStatus);

// Assignments
router.patch('/:id/assign-vendor', authorizeAdminRoles(...operationsRoles), adminOrderController.assignVendor);
router.patch('/:id/assign-rider', authorizeAdminRoles(...operationsRoles), adminOrderController.assignRider);

// Issues
router.post('/:id/issue', authorizeAdminRoles(...operationsRoles), adminOrderController.reportIssue);
router.patch('/:id/resolve-issue', authorizeAdminRoles(...operationsRoles), adminOrderController.resolveIssue);

module.exports = router;
