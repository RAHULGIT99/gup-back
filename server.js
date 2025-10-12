const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const dotenv = require('dotenv');
const axios = require('axios');

// --- 1. INITIAL SETUP & CONFIGURATION ---
dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

const debug = (...args) => {
    if (process.env.DEBUG !== 'false') {
        console.log('[DEBUG]', ...args);
    }
};

const sanitizeBody = (body) => {
    if (!body || typeof body !== 'object') return body;
    const clone = Array.isArray(body) ? body.map((item) => sanitizeBody(item)) : { ...body };
    if (!Array.isArray(clone)) {
        ['password', 'token'].forEach((field) => {
            if (clone[field] !== undefined) {
                clone[field] = '***';
            }
        });
    }
    return clone;
};

app.use((req, res, next) => {
    const start = Date.now();
    const originalJson = res.json.bind(res);

    res.json = (data) => {
        res.locals.responseBody = data;
        return originalJson(data);
    };

    debug('Request received', {
        method: req.method,
        path: req.originalUrl,
        body: sanitizeBody(req.body),
    });

    res.on('finish', () => {
        debug('Response sent', {
            method: req.method,
            path: req.originalUrl,
            status: res.statusCode,
            durationMs: Date.now() - start,
            body: sanitizeBody(res.locals.responseBody),
        });
    });

    next();
});

// --- 2. DATABASE CONNECTION ---
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`MongoDB connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`MongoDB connection failed: ${error.message}`);
        process.exit(1);
    }
};
connectDB();

// --- 3. DATABASE MODELS (SCHEMAS) ---
const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 6, select: false },
});
 
UserSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});
const User = mongoose.model('users_intellisnipet', UserSchema);

const SnippetSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },
    code: { type: String, required: true },
    language: { type: String, required: true },
    summary: { type: String, required: true },
    notes: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
});
const Snippet = mongoose.model('Snippet', SnippetSchema);

// --- 4. AUTHENTICATION MIDDLEWARE ---
const protect = async (req, res, next) => {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
        debug('Auth failed - No token provided.');
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            debug('Auth failed - User not found for token.', decoded.id);
            return res.status(401).json({ success: false, message: 'Not authorized' });
        }
        req.user = user;
        debug('Auth passed for user.', req.user.id.toString());
        next();
    } catch (err) {
        debug('Auth failed - Invalid token.', err.message);
        return res.status(401).json({ success: false, message: 'Not authorized' });
    }
};

// --- 5. API ROUTES & CONTROLLERS ---

// --- AUTH ROUTES ---
app.post('/auth/register', async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return res.status(400).json({ success: false, message: 'Username, email, and password are required.' });
    }

    try {
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            debug('Registration attempt with duplicate username or email.', { username, email });
            return res.status(409).json({ success: false, message: 'Username or email already in use.' });
        }

        const user = await User.create({ username, email, password });
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });

        debug('User registered successfully.', user._id.toString());
        res.status(201).json({ success: true, token });
    } catch (error) {
        if (error.code === 11000) {
            debug('Registration failed due to duplicate key.', error.keyValue);
            return res.status(409).json({ success: false, message: 'Username or email already in use.' });
        }
        debug('Registration failed due to server error.', error.message);
        res.status(500).json({ success: false, message: 'Unable to create account.' });
    }
});

app.post('/auth/login', async (req, res) => {
    // Accept either `identifier` (email or username) or `email` for backwards compatibility
    const { identifier, email, password } = req.body;
    const id = identifier || email;

    if (!id || !password) {
        return res.status(400).json({ success: false, message: 'Please provide email/username and password' });
    }
    try {
        // Try to find user by email OR username
        const user = await User.findOne({ $or: [{ email: id }, { username: id }] }).select('+password');
        if (!user || !(await bcrypt.compare(password, user.password))) {
            debug('Login failed - Invalid credentials for identifier.', id);
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }
        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '30d' });
        debug('Login succeeded for user.', user._id.toString());
        res.status(200).json({ success: true, token });
    } catch (error) {
        debug('Login failed due to server error.', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// --- SNIPPET & AI ROUTES (PROTECTED) ---
app.get('/api/snippets', protect, async (req, res) => {
    try {
        const snippets = await Snippet.find({ user: req.user.id }).sort({ createdAt: -1 });
        debug('Snippets fetched for user.', { userId: req.user.id.toString(), count: snippets.length });
        res.status(200).json({ success: true, count: snippets.length, data: snippets });
    } catch (error) {
        debug('Fetching snippets failed.', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.post('/api/snippets', protect, async (req, res) => {
    const { code, notes } = req.body;
    if (!code) {
        return res.status(400).json({ success: false, message: 'Code is required' });
    }
    try {
        const fastApiUrl = process.env.FASTAPI_URL;
        if (!fastApiUrl) {
            debug('Snippet creation failed - FASTAPI_URL missing.');
            return res.status(500).json({ success: false, message: 'AI service URL not configured.' });
        }

        const aiResponse = await axios.post(`${fastApiUrl}/analyze`, { code });
        const { language, summary } = aiResponse.data;

        const snippet = await Snippet.create({ user: req.user.id, code, notes, language, summary });
        debug('Snippet created.', { snippetId: snippet._id.toString(), userId: req.user.id.toString() });
        res.status(201).json({ success: true, data: snippet });
    } catch (error) {
        const errorMessage = error.response?.data?.detail || error.message;
        debug('Snippet creation failed.', errorMessage);
        res.status(500).json({ success: false, message: errorMessage });
    }
});

app.post('/api/ai/query', protect, async (req, res) => {
    const { code, prompt } = req.body;
     if (!code || !prompt) {
        return res.status(400).json({ success: false, message: 'Code and prompt are required' });
    }
    try {
        const fastApiUrl = process.env.FASTAPI_URL;
        if (!fastApiUrl) {
            debug('AI query failed - FASTAPI_URL missing.');
            return res.status(500).json({ success: false, message: 'AI service URL not configured.' });
        }

        const aiResponse = await axios.post(`${fastApiUrl}/query`, { code, prompt });
        debug('AI query succeeded for user.', req.user.id.toString());
        res.status(200).json({ success: true, data: aiResponse.data });
    } catch (error) {
        const errorMessage = error.response?.data?.detail || error.message;
        debug('AI query failed.', errorMessage);
        res.status(500).json({ success: false, message: errorMessage });
    }
});


// --- 6. START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));