const mongoose = require('mongoose');

const donationSchema = new mongoose.Schema({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, match: /^[0-9]{10}$/, trim: true },
  address: { type: String, required: true },
  donationAmount: { type: Number, required: true, min: 1 },
  message: { type: String },
//   paymentStatus: {
//     type: String,
//     enum: ['Pending', 'Success', 'Failed'], // You can adjust statuses as needed
//     default: 'Pending'
//   },
  paymentStatus: {
    status: String,
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Donation', donationSchema);
