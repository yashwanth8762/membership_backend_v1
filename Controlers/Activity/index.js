const Activity = require('../../Modals/Activity');
const mongoose = require('mongoose');
const { validationResult } = require('express-validator');

// Create Activity
exports.createActivity = async (req, res) => {
    const errors = validationResult(req);
  
    if (!errors.isEmpty()) {
      return res.status(STATUS.BAD_REQUEST).json({
        message: `Bad request`,
      });
    }

    // REMOVE AUTH CHECKS
  try {
    const { title, about, k_title, k_about, media_file } = req.body;
    if (!title || !about) {
      return res.status(400).json({ message: 'Title and about are required.' });
    }
    const activity = new Activity({
      title,
      k_title,
      about,
      k_about,
      media_file: Array.isArray(media_file) ? media_file : (media_file ? [media_file] : [])
      // Optionally: created_by: req.userId
    });
    await activity.save();
    return res.status(201).json({ message: 'Activity created successfully', data: activity });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create activity', error });
  }
};

// Edit Activity
exports.editActivity = async (req, res) => {
  // Remove authentication check
  try {
    const { id } = req.params;
    const { title, about, k_title, k_about, media_file } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (k_title !== undefined) update.k_title = k_title;
    if (about !== undefined) update.about = about;
    if (k_about !== undefined) update.k_about = k_about;
    if (media_file !== undefined) update.media_file = Array.isArray(media_file) ? media_file : [media_file];
    const activity = await Activity.findByIdAndUpdate(id, update, { new: true });
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }
    return res.status(200).json({ message: 'Activity updated successfully', data: activity });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update activity', error });
  }
};

// Delete Activity
exports.deleteActivity = async (req, res) => {
  // Remove authentication check
  try {
    const { id } = req.params;
    const activity = await Activity.findByIdAndDelete(id);
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }
    return res.status(200).json({ message: 'Activity deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete activity', error });
  }
};

exports.getAllActivities = async (req, res) => {
  try {
    const activities = await Activity.find()
      .sort({ createdAt: -1 })
      .populate({
        path: 'media_file',
        select: 'image_url doc_url video_url extension name',
      });
    return res.status(200).json({ data: activities });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch activities', error });
  }
};

exports.getActivityById = async (req, res) => {
  try {
    const activity = await Activity.findById(req.params.id).populate({
      path: 'media_file',
      select: 'image_url doc_url video_url extension name',
    });
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }
    return res.status(200).json({ data: activity });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch activity', error });
  }
};

exports.updateActivity = async (req, res) => {
  try {
    const { title, about, k_title, k_about, media_file } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (k_title !== undefined) update.k_title = k_title;
    if (about !== undefined) update.about = about;
    if (k_about !== undefined) update.k_about = k_about;
    if (media_file !== undefined) update.media_file = Array.isArray(media_file) ? media_file : [media_file];
    const activity = await Activity.findByIdAndUpdate(req.params.id, update, { new: true }).populate({
      path: 'media_file',
      select: 'image_url doc_url video_url extension name',
    });
    if (!activity) {
      return res.status(404).json({ message: 'Activity not found' });
    }
    return res.status(200).json({ message: 'Activity updated successfully', data: activity });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update activity', error });
  }
};
