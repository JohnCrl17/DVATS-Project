const express = require('express');
const router = express.Router();
const enforcerController = require('./enforcerController'); // Siguraduhin na tama ang path ng file mo pre

// I-map ang endpoints para sa registration sequence
router.post('/verify-badge', enforcerController.verifyBadge);
router.post('/verify-otp', enforcerController.verifyOtp);
router.post('/activate-account', enforcerController.activateAccount);

module.exports = router;