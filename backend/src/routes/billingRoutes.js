const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billingController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

router.get('/', authenticate, authorize('STAFF', 'ADMIN', 'DOCTOR'), (req, res, next) => billingController.getAllBills(req, res, next));
router.get('/logs', authenticate, authorize('ADMIN'), (req, res, next) => billingController.getBillingLogs(req, res, next));
router.get('/whatsapp-messages', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.getWhatsAppMessages(req, res, next));
router.post('/whatsapp/:messageId/retry', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.retryWhatsAppMessage(req, res, next));
router.get('/links/:billId', authenticate, authorize('STAFF', 'ADMIN', 'DOCTOR'), (req, res, next) => billingController.getBillLinks(req, res, next));
router.post('/links/:billId/generate', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.generateBillLink(req, res, next));
router.post('/links/:linkId/revoke', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.revokeBillLink(req, res, next));
router.delete('/patient/:patientId', authenticate, authorize('ADMIN'), (req, res, next) => billingController.deletePatientBills(req, res, next));
router.get('/:id', authenticate, authorize('STAFF', 'ADMIN', 'DOCTOR'), (req, res, next) => billingController.getBillById(req, res, next));
router.post('/', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.createBill(req, res, next));
router.post('/connected-register-bill', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.connectedRegisterAndBill(req, res, next));
router.patch('/:id/payment', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.updatePayment(req, res, next));
router.put('/:id', authenticate, authorize('STAFF', 'ADMIN'), (req, res, next) => billingController.updateBill(req, res, next));
router.delete('/:id', authenticate, authorize('ADMIN'), (req, res, next) => billingController.deleteBill(req, res, next));

module.exports = router;
