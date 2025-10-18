const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
    name: { type: String, required: true },
    timezone: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Profile', ProfileSchema);
