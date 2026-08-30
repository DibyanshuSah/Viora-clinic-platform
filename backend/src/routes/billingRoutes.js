const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

router.get('/', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.getAllBills(req, res, next));
router.get('/:id', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.getBillById(req, res, next));
router.post('/', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.createBill(req, res, next));
router.post('/connected-register-bill', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.connectedRegisterAndBill(req, res, next));
router.patch('/:id/payment', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.updatePayment(req, res, next));

module.exports = router;
