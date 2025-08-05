const mongoose = require('mongoose');
const { Schema, ObjectId } = mongoose;

const gallerySchema = new Schema(
    {
       
       
        media: [
            {
            type: ObjectId,
            ref: "media",
            required: true,
            }
          ],        
    },
    {
        timestamps: true
    }
);
gallerySchema.set("toJSON", {
    transform: (doc, ret, options) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('gallery', gallerySchema);
