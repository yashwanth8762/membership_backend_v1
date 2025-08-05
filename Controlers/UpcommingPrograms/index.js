const Programs = require('../../Modals/UpcommingPrograms');
const { validationResult } = require('express-validator');

exports.createProgram = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ message: 'Bad request', errors });
  }
  try {
    const { title, k_title, about, k_about, location, k_location, program_date, program_time, media_file } = req.body;
    if (!title || !about || !location || !program_date) {
      return res.status(400).json({ message: 'Title, about, location, and program_date are required.' });
    }
    const program = new Programs({
      title,
      k_title,
      about,
      k_about,
      location,
      k_location,
      program_date,
      program_time,
      media_file: Array.isArray(media_file) ? media_file : (media_file ? [media_file] : [])
    });
    await program.save();
    return res.status(201).json({ message: 'Program created successfully', data: program });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to create program', error });
  }
};

exports.getAllPrograms = async (req, res) => {
  try {
    const programs = await Programs.find()
      .sort({ program_date: 1 })
      .populate({ path: 'media_file', select: 'image_url doc_url video_url extension name' });
    return res.status(200).json({ data: programs });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch programs', error });
  }
};

exports.getProgramById = async (req, res) => {
  try {
    const program = await Programs.findById(req.params.id).populate({ path: 'media_file', select: 'image_url doc_url video_url extension name' });
    if (!program) {
      return res.status(404).json({ message: 'Program not found' });
    }
    return res.status(200).json({ data: program });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to fetch program', error });
  }
};

exports.updateProgram = async (req, res) => {
  try {
    const { title, k_title, about, k_about, location, k_location, program_date, program_time, media_file } = req.body;
    const update = {};
    if (title !== undefined) update.title = title;
    if (k_title !== undefined) update.k_title = k_title;
    if (about !== undefined) update.about = about;
    if (k_about !== undefined) update.k_about = k_about;
    if (location !== undefined) update.location = location;
    if (k_location !== undefined) update.k_location = k_location;
    if (program_date !== undefined) update.program_date = program_date;
    if (program_time !== undefined) update.program_time = program_time;
    if (media_file !== undefined) update.media_file = Array.isArray(media_file) ? media_file : [media_file];
    if (location === undefined || location === '') {
      return res.status(400).json({ message: 'Location is required.' });
    }
    const program = await Programs.findByIdAndUpdate(req.params.id, update, { new: true }).populate({ path: 'media_file', select: 'image_url doc_url video_url extension name' });
    if (!program) {
      return res.status(404).json({ message: 'Program not found' });
    }
    return res.status(200).json({ message: 'Program updated successfully', data: program });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to update program', error });
  }
};

exports.deleteProgram = async (req, res) => {
  try {
    const program = await Programs.findByIdAndDelete(req.params.id);
    if (!program) {
      return res.status(404).json({ message: 'Program not found' });
    }
    return res.status(200).json({ message: 'Program deleted successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Failed to delete program', error });
  }
};
