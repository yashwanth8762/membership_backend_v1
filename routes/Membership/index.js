const express = require('express');
const router = express.Router();
const membershipController = require('../../Controlers/Membership');

// Admin: Create a new membership form structure
router.post('/form', membershipController.createForm);

// Admin: Get all membership forms
router.get('/form', membershipController.getForms);

// User: Submit a membership form
router.post('/submit', membershipController.submitMembership);


router.get('/check-status', membershipController.getStatusOfPayment);


// User: Get a membership submission by membershipId
router.get('/submission/:membershipId', membershipController.getMembershipById);

// QR landing: Redirect to frontend user membership page
router.get('/user/:membershipId', membershipController.redirectToUserMembershipPage);

// User: Get all membership submissions filtered by district, taluk, and must include "ID card"
router.get('/submissions', membershipController.getMembershipsFiltered);


module.exports = router; 