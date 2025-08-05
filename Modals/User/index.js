const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;



const userSchema = new Schema(
    {
      first_name: {
        type: String,
        required: true
    },
    last_name: {
        type: String,
        required: true
    },
    email_data: {
      email_id: {
          type: String,
          required: false
      },
      temp_email_id: {
          type: String,
          required: false
      },
      is_validated: {
          type: Boolean,
          default: false
      },
      
      timestamp: {
          type: Date,
          required: false
      }
  },
      password: {
        type: String,
        required: true,
      },
      role: {
        type: String,
        enum: ['ADMIN', 'USER'],
        default: 'ADMIN'
      },
      createdAt: {
        type: Date,
        default: Date.now,
      }
    }
);

userSchema.index({
    first_name: 'text',
    last_name: 'text',
    'email_data.email_id': 'text',
    // 'phone_data.phone_number': 'text'
});


userSchema.set("toJSON", {
    transform: (doc, ret, options) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('user', userSchema);
