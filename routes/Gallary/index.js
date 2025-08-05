const express = require('express');
const router = express.Router();
const galleryController = require('../../Controlers/Gallary');

// POST a new gallery
router.post('/', galleryController.createGallery);

// GET all galleries
router.get('/', galleryController.getAllGalleries);

// GET a single gallery by ID
router.get('/:id', galleryController.getGalleryById);

// DELETE a gallery by ID
router.delete('/:id', galleryController.deleteGallery);

module.exports = router;
