const Event = require('../models/Event');
const EventLog = require('../models/EventLog');
const Profile = require('../models/Profile');
const { fromUserTZ, formatInTZ, isValidTZ } = require('../utils/timezone');

const toUTC = (dateStr, tz) => {
    // dateStr can be ISO or local string; fromUserTZ handles conversion
    return fromUserTZ(dateStr, tz);
};

exports.createEvent = async (req, res) => {
    const { profiles, timezone, startDateTime, endDateTime, title, description, createdBy } = req.body;
    if (!profiles || !profiles.length) return res.status(400).json({ success: false, message: 'profiles required' });
    if (!timezone || !isValidTZ(timezone)) return res.status(400).json({ success: false, message: 'valid timezone required' });
    if (!startDateTime || !endDateTime) return res.status(400).json({ success: false, message: 'start and end required' });
    try {
        // validate profiles exist
        const existing = await Profile.find({ _id: { $in: profiles } });
        if (existing.length !== profiles.length) return res.status(400).json({ success: false, message: 'one or more profiles not found' });

        const startUTC = toUTC(startDateTime, timezone);
        const endUTC = toUTC(endDateTime, timezone);
        if (endUTC <= startUTC) return res.status(400).json({ success: false, message: 'end must be after start' });
        // prevent past dates
        const now = new Date();
        if (endUTC < now) return res.status(400).json({ success: false, message: 'end cannot be in the past' });

    const ev = await Event.create({ profiles, timezone, startDateTime: startUTC, endDateTime: endUTC, title, description, createdBy: createdBy || (req.user && req.user._id) });
        res.status(201).json({ success: true, data: ev });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getEvents = async (req, res) => {
    const { profile } = req.query;
    try {
        let query = {};
        if (profile) query.profiles = profile;
        const events = await Event.find(query).populate('profiles').sort({ startDateTime: 1 });

        // If a profile id is provided, convert dates to that profile's timezone for display
        if (profile) {
            const prof = await Profile.findById(profile);
            if (prof) {
                const mapped = events.map(ev => ({
                    ...ev.toObject(),
                    startInProfileTZ: formatInTZ(ev.startDateTime, prof.timezone),
                    endInProfileTZ: formatInTZ(ev.endDateTime, prof.timezone),
                    createdAtInProfileTZ: formatInTZ(ev.createdAt, prof.timezone),
                    updatedAtInProfileTZ: formatInTZ(ev.updatedAt, prof.timezone),
                }));
                return res.json({ success: true, data: mapped });
            }
        }

        res.json({ success: true, data: events });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getEvent = async (req, res) => {
    const { id } = req.params;
    try {
        const ev = await Event.findById(id).populate('profiles');
        if (!ev) return res.status(404).json({ success: false, message: 'not found' });

        const profile = req.query.profile;
        if (profile) {
            const prof = await Profile.findById(profile);
            if (prof) {
                const obj = ev.toObject();
                obj.startInProfileTZ = formatInTZ(ev.startDateTime, prof.timezone);
                obj.endInProfileTZ = formatInTZ(ev.endDateTime, prof.timezone);
                obj.createdAtInProfileTZ = formatInTZ(ev.createdAt, prof.timezone);
                obj.updatedAtInProfileTZ = formatInTZ(ev.updatedAt, prof.timezone);
                return res.json({ success: true, data: obj });
            }
        }

        res.json({ success: true, data: ev });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.updateEvent = async (req, res) => {
    const { id } = req.params;
    const payload = req.body;
    try {
        const ev = await Event.findById(id);
        if (!ev) return res.status(404).json({ success: false, message: 'not found' });

        const logs = [];

        // handle timezone change or datetime changes
        if (payload.timezone && !isValidTZ(payload.timezone)) return res.status(400).json({ success: false, message: 'invalid timezone' });

        if (payload.startDateTime || payload.endDateTime) {
            const tz = payload.timezone || ev.timezone;
            const newStart = payload.startDateTime ? fromUserTZ(payload.startDateTime, tz) : ev.startDateTime;
            const newEnd = payload.endDateTime ? fromUserTZ(payload.endDateTime, tz) : ev.endDateTime;
            if (newEnd <= newStart) return res.status(400).json({ success: false, message: 'end must be after start' });
            if (newEnd < new Date()) return res.status(400).json({ success: false, message: 'end cannot be in the past' });
            if (newStart.getTime() !== ev.startDateTime.getTime()) logs.push({ field: 'startDateTime', oldValue: ev.startDateTime, newValue: newStart });
            if (newEnd.getTime() !== ev.endDateTime.getTime()) logs.push({ field: 'endDateTime', oldValue: ev.endDateTime, newValue: newEnd });
            ev.startDateTime = newStart;
            ev.endDateTime = newEnd;
        }

        if (payload.title && payload.title !== ev.title) logs.push({ field: 'title', oldValue: ev.title, newValue: payload.title });
        if (payload.description && payload.description !== ev.description) logs.push({ field: 'description', oldValue: ev.description, newValue: payload.description });
        if (payload.timezone && payload.timezone !== ev.timezone) logs.push({ field: 'timezone', oldValue: ev.timezone, newValue: payload.timezone });
        if (payload.profiles) {
            // ensure all profiles exist
            const existing = await Profile.find({ _id: { $in: payload.profiles } });
            if (existing.length !== payload.profiles.length) return res.status(400).json({ success: false, message: 'one or more profiles not found' });
            logs.push({ field: 'profiles', oldValue: ev.profiles, newValue: payload.profiles });
            ev.profiles = payload.profiles;
        }

        // apply simple fields
        if (payload.title) ev.title = payload.title;
        if (payload.description) ev.description = payload.description;
        if (payload.timezone) ev.timezone = payload.timezone;
        ev.updatedAt = new Date();
        await ev.save();

        // create logs
        if (logs.length) {
            for (const l of logs) {
                await EventLog.create({ eventId: ev._id, profileId: payload.updatedBy || (req.user && req.user._id) || null, field: l.field, oldValue: l.oldValue, newValue: l.newValue, timestamp: new Date() });
            }
        }

        res.json({ success: true, data: ev });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getEventLogs = async (req, res) => {
    const { id } = req.params;
    try {
        const logs = await EventLog.find({ eventId: id }).populate('profileId').sort({ timestamp: -1 });
        const profile = req.query.profile;
        if (profile) {
            const prof = await Profile.findById(profile);
            if (prof) {
                const mapped = logs.map(l => ({
                    ...l.toObject(),
                    timestampInProfileTZ: formatInTZ(l.timestamp, prof.timezone),
                }));
                return res.json({ success: true, data: mapped });
            }
        }
        res.json({ success: true, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
