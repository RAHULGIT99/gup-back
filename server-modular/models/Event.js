const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
    profiles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Profile', required: true }],
    timezone: { type: String, required: true },
    startDateTime: { type: Date, required: true }, // stored in UTC
    endDateTime: { type: Date, required: true }, // stored in UTC
    title: { type: String, required: true },
    description: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
}, { timestamps: true });

module.exports = mongoose.model('Event', EventSchema);
