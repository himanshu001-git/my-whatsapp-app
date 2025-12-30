const express = require('express');
const router = express.Router();
const User = require('../models/User');

// Signup
router.post('/signup', async (req, res) => {
    try {
        const { username, password } = req.body;
        const existingUser = await User.findOne({ username });
        if (existingUser) return res.status(400).json({ message: 'Username already exists' });

        const navigateUser = new User({ username, password });
        await navigateUser.save();
        res.status(201).json(navigateUser);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Login
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (!user) return res.status(404).json({ message: 'User not found' });
        if (user.password !== password) return res.status(400).json({ message: 'Invalid credentials' });

        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get All Users (for sidebar)
router.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, '-password');
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update User Profile
router.put('/profile/:id', async (req, res) => {
    try {
        const { avatar, about, status } = req.body;
        const updates = {};
        if (avatar) updates.avatar = avatar;
        if (about) updates.about = about;
        if (status) updates.status = status;

        const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
