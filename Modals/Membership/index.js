const mongoose = require("mongoose");
const Schema = mongoose.Schema;

// Schema for the dynamic form structure (created by admin)
const membershipFormSchema = new Schema({
  fields: [
    {
      inputType: {
        type: String,
        required: true,
        enum: ['text', 'checkbox', 'radio', 'textarea', 'dropdown', 'media', 'number']
      },
      label: { type: String, required: true },
      options: [String], // For dropdown, radio, checkbox
      required: { type: Boolean, default: false },
      order: { type: Number, default: 0 },
    }
  ],
  createdAt: { type: Date, default: Date.now }
});

// Schema for user membership submissions
const membershipSubmissionSchema = new Schema({
  membershipId: { type: String, required: true, unique: true }, // Randomly generated
  formId: { type: mongoose.Schema.Types.ObjectId, ref: 'membership_form', required: true },
  values: [
    {
      label: { type: String, required: true },
      value: mongoose.Schema.Types.Mixed,
      media: [{ type: mongoose.Schema.Types.ObjectId, ref: 'media' }],
    }
  ],
  submittedAt: { type: Date, default: Date.now }
});

membershipFormSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

membershipSubmissionSchema.set("toJSON", {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

module.exports = {
  MembershipForm: mongoose.model("membership_form", membershipFormSchema),
  MembershipSubmission: mongoose.model("membership_submission", membershipSubmissionSchema)
};
