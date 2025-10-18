const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();

// Enable CORS for all origins
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: false
}));

app.use(express.json());

const debug = (...args) => {
    if (process.env.DEBUG !== 'false') {
        console.log('[DEBUG]', ...args);
    }
};

// Simple request logging
app.use((req, res, next) => {
    const start = Date.now();
    const originalJson = res.json.bind(res);
    res.json = (data) => {
        res.locals.responseBody = data;
        return originalJson(data);
    };
    debug('Request', { method: req.method, path: req.originalUrl });
    res.on('finish', () => {
        debug('Response', { path: req.originalUrl, status: res.statusCode, durationMs: Date.now() - start });
    });
    next();
});

// Connect DB
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB connection failed: ${error.message}`);
        process.exit(1);
    }
};
connectDB();

// Routes
app.use('/api/auth', require('./routes/auth'));
// protect profiles/events with auth middleware
const protect = require('./middleware/auth');
app.use('/api/profiles', protect, require('./routes/profiles'));
app.use('/api/events', protect, require('./routes/events'));

// Basic health
app.get('/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
