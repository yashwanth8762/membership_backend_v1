const { MembershipForm, MembershipSubmission } = require('../../Modals/Membership');
const crypto = require('crypto');

// Admin: Create a new membership form structure
exports.createForm = async (req, res) => {
  try {
    const { fields } = req.body;
    const form = new MembershipForm({ fields });
    await form.save();
    res.status(201).json(form);
  } catch (error) {
    res.status(500).json({ message: 'Error creating form', error: error.message });
  }
};

// Admin: Get all membership forms
exports.getForms = async (req, res) => {
  try {
    const forms = await MembershipForm.find();
    res.json(forms);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching forms', error: error.message });
  }
};

// User: Submit a membership form
exports.submitMembership = async (req, res) => {
  try {
    const { formId, values } = req.body;
    // Generate a random membershipId
    const membershipId = crypto.randomBytes(8).toString('hex');
    const submission = new MembershipSubmission({
      membershipId,
      formId,
      values,
    });
    await submission.save();
    res.status(201).json({ membershipId, submission });
  } catch (error) {
    res.status(500).json({ message: 'Error submitting membership', error: error.message });
  }
};

// User: Get a membership submission by membershipId
exports.getMembershipById = async (req, res) => {
  try {
    const { membershipId } = req.params;
    const submission = await MembershipSubmission.findOne({ membershipId });
    if (!submission) {
      return res.status(404).json({ message: 'Membership not found' });
    }
    res.json(submission);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching membership', error: error.message });
  }
}; 