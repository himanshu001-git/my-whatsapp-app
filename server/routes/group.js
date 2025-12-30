const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const Message = require('../models/Message');

// Create a new group
router.post('/create', async (req, res) => {
    try {
        const { name, members, adminId } = req.body;
        // members should be an array of IDs. Ensure admin is included.
        const allMembers = [...new Set([...members, adminId])];

        const newGroup = new Group({
            name,
            members: allMembers,
            admins: [adminId]
        });

        await newGroup.save();
        res.status(201).json(newGroup);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get user's groups
router.get('/mygroups/:userId', async (req, res) => {
    try {
        const groups = await Group.find({ members: req.params.userId })
            .populate('lastMessage.sender', 'username');
        res.json(groups);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get group messages
router.get('/:groupId/messages', async (req, res) => {
    try {
        const messages = await Message.find({ groupId: req.params.groupId })
            .populate('sender', 'username avatar') // Need sender info for group chats
            .sort({ createdAt: 1 });
        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
