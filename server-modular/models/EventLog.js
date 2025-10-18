const mongoose = require('mongoose');

const EventLogSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    profileId: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
    field: { type: String, required: true },
    oldValue: { type: mongoose.Schema.Types.Mixed },
    newValue: { type: mongoose.Schema.Types.Mixed },
    timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model('EventLog', EventLogSchema);
