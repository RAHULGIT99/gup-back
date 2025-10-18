const jwt = require('jsonwebtoken');
const User = require('../models/User');

const signToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });

exports.register = async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ message: 'username, email and password required' });
    try {
        const exists = await User.findOne({ $or: [{ email }, { username }] });
        if (exists) return res.status(409).json({ message: 'username or email already in use' });
        const user = await User.create({ username, email, password });
        const token = signToken(user._id);
        res.status(201).json({ token });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

exports.login = async (req, res) => {
    const { identifier, email, password } = req.body;
    const id = identifier || email;
    if (!id || !password) return res.status(400).json({ message: 'provide identifier and password' });
    try {
        const user = await User.findOne({ $or: [{ email: id }, { username: id }] }).select('+password');
        if (!user || !(await user.matchPassword(password))) return res.status(401).json({ message: 'invalid credentials' });
        const token = signToken(user._id);
        res.json({ token });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};
