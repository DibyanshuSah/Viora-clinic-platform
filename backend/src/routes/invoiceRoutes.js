const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoiceController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

router.get('/:id', authenticate, authorize('STAFF', 'ADMIN', 'DOCTOR'), (req, res, next) => invoiceController.getInvoice(req, res, next));

module.exports = router;
