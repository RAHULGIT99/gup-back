const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const Profile = require('./models/Profile');
const Event = require('./models/Event');
const { fromUserTZ } = require('./utils/timezone');

// Load env from local .env, then fallback to parent .env if present
const envFiles = [path.resolve(__dirname, '.env'), path.resolve(__dirname, '..', '.env')];
for (const envPath of envFiles) {
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath, override: false });
    }
}

// Finally try default resolution so process-level vars still apply
dotenv.config({ override: false });

const MONGO = process.env.MONGODB_URI || process.env.MONGO_URI;
if (!MONGO) {
    console.error('Set MONGODB_URI in env or .env');
    process.exit(1);
}

const run = async () => {
    await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
    await Profile.deleteMany({});
    await Event.deleteMany({});

    const a = await Profile.create({ name: 'Alice', timezone: 'America/Los_Angeles' });
    const b = await Profile.create({ name: 'Bob', timezone: 'America/New_York' });

    // create sample user for authentication
    const User = require('./models/User');
    await User.deleteMany({});
    const user = await User.create({ username: 'admin', email: 'admin@example.com', password: 'password' });
    console.log('Created sample user: admin / password');

    // create example event in PST
    const start = fromUserTZ('2025-11-01T09:00:00', 'America/Los_Angeles');
    const end = fromUserTZ('2025-11-01T10:00:00', 'America/Los_Angeles');
    await Event.create({ profiles: [a._id, b._id], timezone: 'America/Los_Angeles', startDateTime: start, endDateTime: end, title: 'Team Sync', description: 'Weekly sync', createdBy: a._id });

    console.log('Seed complete');
    process.exit(0);
};

run().catch(err => { console.error(err); process.exit(1); });
