const Gallery = require('../../Modals/Gallary');
const Media = require('../../Modals/Media');
const mongoose = require('mongoose');

exports.createGallery = async (req, res) => {
    try {
        const { media } = req.body;
        if (!media || !Array.isArray(media) || media.length === 0) {
            return res.status(400).json({ message: 'Media items are required' });
        }
        const newGallery = new Gallery({ media });
        await newGallery.save();
        res.status(201).json(newGallery);
    } catch (error) {
        res.status(500).json({ message: 'Error creating gallery', error: error.message });
    }
};

exports.getAllGalleries = async (req, res) => {
    try {
        const galleries = await Gallery.find().populate('media');
        res.status(200).json(galleries);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching galleries', error: error.message });
    }
};

exports.getGalleryById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid gallery ID' });
        }
        const gallery = await Gallery.findById(id).populate('media');
        if (!gallery) {
            return res.status(404).json({ message: 'Gallery not found' });
        }
        res.status(200).json(gallery);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching gallery', error: error.message });
    }
};

exports.deleteGallery = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid gallery ID' });
        }
        const deletedGallery = await Media.findByIdAndDelete(id);
        if (!deletedGallery) {
            return res.status(404).json({ message: 'Gallery not found' });
        }
        res.status(200).json({ message: 'Gallery deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting gallery', error: error.message });
    }
};
