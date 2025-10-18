const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/profilesController');

router.post('/', ctrl.createProfile);
router.get('/', ctrl.getProfiles);
router.patch('/:id', ctrl.updateProfile);

module.exports = router;
