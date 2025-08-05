const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const nameHistorySchema = new Schema(
    {
        name: { 
            type: String, 
            required: true 
        },
        created_by: { 
            type: String, 
            required: true 
        },
        moderated_by: { 
            type: String, 
            required: false 
        },
        approved_by: { 
            type: String, 
            required: false 
        }
    },
    {
        timestamps: true
    }
)

nameHistorySchema.set("toJSON", {
    transform: (doc, ret, options) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

const mediaSchema = new Schema(
    {
        name: {
            temp: { 
                type: String, 
                required: true 
            },
            original: { 
                type: String, 
                required: true 
            },
            current: { 
                type: String, 
                required: true 
            },
            history: [nameHistorySchema]
        },
        extension: {
            original: { 
                type: String, 
                required: true 
            },
            current: { 
                type: String, 
                required: true 
            }
        },
        size: {
            original: { 
                type: Number, 
                required: true 
            },
            current: { 
                type: Number, 
                required: true 
            },
        },
        image_url: {
            full: {
                high_res: { 
                    type: String, 
                    required: false 
                },
                low_res: { 
                    type: String, 
                    required: false 
                }
            },
            thumbnail: {
                high_res: { 
                    type: String, 
                    required: false 
                },
                low_res: { 
                    type: String, 
                    required: false 
                }
            },
        },
        doc_url: { 
            type: String,
            required: false 
        },
        video_url: {
            video: {
                full_res: { 
                    type: String, 
                    required: false 
                },
                low_res: { 
                    type: String, 
                    required: false 
                }
            },
            thumbnail: {
                full_res: { 
                    type: String, 
                    required: false 
                },
                low_res: { 
                    type: String, 
                    required: false 
                }
            },
            
        },
        other_file_url: { 
            type: String,
            required: false
        },
        media_type: { 
            type: ObjectId, 
            ref: 'media_type', 
            required: true 
        },
        uploaded_by: { 
            type: ObjectId, 
            ref: 'user', 
            required: false // Make this field optional
        },
        belongs_to_folder: {
            type: Boolean,
            default: false
        },
        is_archived: { 
            type: Boolean, 
            default: false 
        },
        archived_on: { 
            type: Date,
            required: false
        },
    },
    {
        timestamps: true,
    }
);

mediaSchema.set("toJSON", {
    transform: (doc, ret, options) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('media', mediaSchema);