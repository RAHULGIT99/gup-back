const Profile = require('../models/Profile');
const { isValidTZ } = require('../utils/timezone');

exports.createProfile = async (req, res) => {
    const { name, timezone } = req.body;
    if (!name || !timezone) return res.status(400).json({ success: false, message: 'name and timezone required' });
    if (!isValidTZ(timezone)) return res.status(400).json({ success: false, message: 'invalid timezone' });
    try {
        const p = await Profile.create({ name, timezone });
        res.status(201).json({ success: true, data: p });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getProfiles = async (req, res) => {
    try {
        const profiles = await Profile.find().sort({ createdAt: -1 });
        res.json({ success: true, data: profiles });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateProfile = async (req, res) => {
    const { id } = req.params;
    const { timezone } = req.body;
    if (!timezone) return res.status(400).json({ success: false, message: 'timezone required' });
    if (!isValidTZ(timezone)) return res.status(400).json({ success: false, message: 'invalid timezone' });
    try {
        const profile = await Profile.findByIdAndUpdate(id, { timezone }, { new: true });
        if (!profile) return res.status(404).json({ success: false, message: 'not found' });
        res.json({ success: true, data: profile });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
