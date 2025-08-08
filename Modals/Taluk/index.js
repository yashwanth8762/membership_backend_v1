const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const talukSchema = new Schema(
    {
        taluk_id: {
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
        district: {
            type: Schema.Types.ObjectId,
            ref: "district",
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

talukSchema.set("toJSON", {
    transform: (doc, ret, options) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
    }
});

module.exports = mongoose.model('taluk', talukSchema);