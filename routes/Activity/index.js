const express = require('express');
const router = express.Router();
const activityController = require('../../Controlers/Activity');
const isAuth = require('../../authentication/is-auth');

// Create Activity
router.post('/', activityController.createActivity);

// Edit Activity
router.put('/:id',activityController.editActivity);

// Delete Activity
router.delete('/:id', activityController.deleteActivity);

// Get All Activities
router.get('/', activityController.getAllActivities);

// Get Activity by ID
router.get('/:id', activityController.getActivityById);
// Update Activity
router.put('/:id', activityController.updateActivity);

module.exports = router;
