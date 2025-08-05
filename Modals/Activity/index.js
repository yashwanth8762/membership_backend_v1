const mongoose = require('mongoose');
// const bcrypt = require('bcrypt');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;



const activitySchema = new Schema(
    {
       
        title: {
            type: String,
            required: true
        },
        k_title: {
            type: String,
            required: true
        },
        about: {
            type: String,
            required: true
        },
        k_about: {
            type: String,
            required: true
        },
        media_file: [
            {
            type: ObjectId,
            ref: "media",
            required: false,
            }
          ],        
    },
    {
        timestamps: true
    }
);
activitySchema.set("toJSON", {
    transform: (doc, ret, options) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('activity', activitySchema);
