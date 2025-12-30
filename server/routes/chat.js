const express = require('express');
const router = express.Router();
const Message = require('../models/Message');

// ================= GET CHAT HISTORY =================
router.get('/:userId/:otherId', async (req, res) => {
    try {
        const { userId, otherId } = req.params;

        const messages = await Message.find({
            deletedForEveryone: false,
            $or: [
                {
                    sender: userId,
                    receiver: otherId,
                    deletedFor: { $ne: userId }
                },
                {
                    sender: otherId,
                    receiver: userId,
                    deletedFor: { $ne: userId }
                }
            ]
        }).sort({ createdAt: 1 });

        res.json(messages);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ================= DELETE FOR ME =================
router.put('/delete-for-me/:messageId', async (req, res) => {
    try {
        const { userId } = req.body;

        await Message.findByIdAndUpdate(req.params.messageId, {
            $addToSet: { deletedFor: userId }
        });

        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// DELETE FOR EVERYONE
router.put('/delete-everyone/:messageId', async (req, res) => {
    try {
        const { messageId } = req.params;

        await Message.findByIdAndUpdate(messageId, {
            deletedForEveryone: true,
            content: ''
        });

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});


module.exports = router;
