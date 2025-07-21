const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const mediaExtensionSchema = new Schema (
    {
        name: {
            type: String,
            enum: ['jpg', 'jpeg', 'png', 'webp', 'pdf', 'mov', 'avi', 'mpeg'],
            required: true
        },
        mime_type: {
            type: String,
            required: true
        },
        created_by: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        is_archived: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

mediaExtensionSchema.set("toJSON", {
    transform: (doc, ret, options) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

const mediaTypeSchema = new Schema(
    {
        name: {
            type: String,
            required: true
        },
        extensions: [mediaExtensionSchema],
        icon: {
            type: String,
            required: false
        },
        max_upload_size: {
            type: Number,
            default: 100
        },
        created_by: {
            type: ObjectId,
            ref: 'user',
            required: true
        },
        is_active: {
            type: Boolean,
            default: true
        },
        is_archived: {
            type: Boolean,
            default: false
        }
    },
    {
        timestamps: true
    }
);

mediaTypeSchema.set("toJSON", {
    transform: (doc, ret, options) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('media_type', mediaTypeSchema);