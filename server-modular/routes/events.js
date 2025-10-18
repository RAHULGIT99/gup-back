const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/eventsController');

router.post('/', ctrl.createEvent);
router.get('/', ctrl.getEvents);
router.get('/:id', ctrl.getEvent);
router.patch('/:id', ctrl.updateEvent);
router.get('/:id/logs', ctrl.getEventLogs);

module.exports = router;
