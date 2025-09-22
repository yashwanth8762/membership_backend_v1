const express = require('express');
const router = express.Router();
const donationController = require('../../Controlers/Donation');

// POST /api/donations - submit new donation
router.post('/', donationController.submitDonation);

router.get('/check-status', donationController.getStatusOfPayment);

module.exports = router;
