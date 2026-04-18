const express = require('express');
const adminOrderController = require('../controllers/adminOrderController');

const router = express.Router();

// Middleware to check admin role should go here (omitted for MVP speed)

// Dashboard
router.get('/dashboard/stats', adminOrderController.getDashboardStats);

// Orders
router.get('/', adminOrderController.getAllOrders);
router.get('/issues', adminOrderController.getOrdersWithIssues);
router.get('/:id', adminOrderController.getOrderById);
router.patch('/:id/status', adminOrderController.updateOrderStatus);

// Assignments
router.patch('/:id/assign-vendor', adminOrderController.assignVendor);
router.patch('/:id/assign-rider', adminOrderController.assignRider);

// Issues
router.post('/:id/issue', adminOrderController.reportIssue);
router.patch('/:id/resolve-issue', adminOrderController.resolveIssue);

module.exports = router;
