const express = require('express');
const router = express.Router();
const programController = require('../../Controlers/UpcommingPrograms');

// Create Program
router.post('/', programController.createProgram);
// Get All Programs
router.get('/', programController.getAllPrograms);
// Get Program by ID
router.get('/:id', programController.getProgramById);
// Update Program
router.put('/:id', programController.updateProgram);
// Delete Program
router.delete('/:id', programController.deleteProgram);

module.exports = router;
