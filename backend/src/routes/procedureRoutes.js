const express = require('express');
const router = express.Router();
const procedureController = require('../controllers/procedureController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/role');

router.get('/', authenticate, (req, res, next) => procedureController.getAllProcedures(req, res, next));
router.get('/:id', authenticate, (req, res, next) => procedureController.getProcedureById(req, res, next));
router.post('/', authenticate, authorize('ADMIN'), (req, res, next) => procedureController.createProcedure(req, res, next));
router.put('/:id', authenticate, authorize('ADMIN'), (req, res, next) => procedureController.updateProcedure(req, res, next));
router.delete('/:id', authenticate, authorize('ADMIN'), (req, res, next) => procedureController.deleteProcedure(req, res, next));

module.exports = router;
