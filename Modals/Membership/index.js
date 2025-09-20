// const mongoose = require('mongoose');
// const Schema = mongoose.Schema;
// const ObjectId = Schema.Types.ObjectId;

// // Schema for the dynamic form structure (created by admin)
// const membershipFormSchema = new Schema({
//   fields: [
//     {
//       inputType: {
//         type: String,
//         required: true,
//         enum: ['text', 'checkbox', 'radio', 'textarea', 'dropdown', 'media', 'number'],
//       },
//       label: { type: String, required: true },
//       label_kn: { type: String }, // Kannada label for the field
//       options: [String],           // For dropdown, radio, checkbox
//       required: { type: Boolean, default: false },
//       order: { type: Number, default: 0 },
//     },
//   ],
//   createdAt: { type: Date, default: Date.now },
// });

// // Schema for user membership submissions
// const membershipSubmissionSchema = new Schema({
//   membershipId: { type: String, required: true, unique: true }, // Randomly generated
//   formId: { type: ObjectId, ref: 'membership_form', required: true },
//   district: { type: ObjectId, ref: 'district', required: true },
//   taluk: { type: ObjectId, ref: 'taluk', required: true },

//   adhar_no: { type: String, required: true, unique: true },

//   email: { type: String, required: true },      // Added email field
//   bloodGroup: { type: String, required: false }, // Added bloodGroup field

//   values: [
//     {
//       label: { type: String, required: true },
//       value: Schema.Types.Mixed,
//       media: [{ type: ObjectId, ref: 'media' }],
//     },
//   ],

//   submittedAt: { type: Date, default: Date.now },
// });

// membershipFormSchema.set('toJSON', {
//   transform: (doc, ret, options) => {
//     ret.id = ret._id;
//     delete ret._id;
//     delete ret.__v;
//   },
// });

// membershipSubmissionSchema.set('toJSON', {
//   transform: (doc, ret, options) => {
//     ret.id = ret._id;
//     delete ret._id;
//     delete ret.__v;
//   },
// });

// module.exports = {
//   MembershipForm: mongoose.model('membership_form', membershipFormSchema),
//   MembershipSubmission: mongoose.model('membership_submission', membershipSubmissionSchema),
// };


const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

// Schema for the dynamic form structure (created by admin)
const membershipFormSchema = new Schema({
  fields: [
    {
      inputType: {
        type: String,
        required: true,
        enum: ['text', 'checkbox', 'radio', 'textarea', 'dropdown', 'media', 'number'],
      },
      label: { type: String, required: true },
      label_kn: { type: String }, // Kannada label for the field
      options: [String],           // For dropdown, radio, checkbox
      required: { type: Boolean, default: false },
      order: { type: Number, default: 0 },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});


// Schema to track last membership number per membership type prefix
const membershipCounterSchema = new Schema({
  prefix: { type: String, required: true, unique: true },
  lastNumber: { type: Number, default: 0 },
});


// Schema for user membership submissions
const membershipSubmissionSchema = new Schema({
  membershipId: { type: String, required: true, unique: true },  // New sequential ID like "G-001"
  formId: { type: ObjectId, ref: 'membership_form', required: true },
  district: { type: ObjectId, ref: 'district', required: true },
  taluk: { type: ObjectId, ref: 'taluk', required: true },
  paymentResult: {
    status: String,
  },
  adhar_no: { type: String, required: true, unique: true },
  email: { type: String},
  bloodGroup: { type: String, required: false },

  values: [
    {
      label: { type: String, required: true },
      value: Schema.Types.Mixed,
      media: [{ type: ObjectId, ref: 'media' }],
    },
  ],

  submittedAt: { type: Date, default: Date.now },
});


membershipFormSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});


membershipSubmissionSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

membershipCounterSchema.set('toJSON', {
  transform: (doc, ret, options) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  },
});

// Export all models
module.exports = {
  MembershipForm: mongoose.model('membership_form', membershipFormSchema),
  MembershipSubmission: mongoose.model('membership_submission', membershipSubmissionSchema),
  MembershipCounter: mongoose.model('membership_counter', membershipCounterSchema),
};
