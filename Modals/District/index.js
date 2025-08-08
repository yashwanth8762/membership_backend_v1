const mongoose = require('mongoose');
const Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;

const districtSchema = new Schema(
    {
        district_id: {
            type: Number,
            required: true,
            default: 0
        },
        name: {
            type: String,
            required: true
        },
        k_name: {
            type: String,
            required: false
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

districtSchema.set("toJSON", {
    transform: (doc, ret, options) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('district', districtSchema);