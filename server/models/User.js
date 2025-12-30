const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Plain text for simplicity in this demo
    avatar: { type: String, default: '' },
    about: { type: String, default: 'Hey there! I am using WhatsApp.' },
    status: { type: String, default: 'Available' }, // Online/Offline
    statuses: [{ // Stories/Status updates
        content: String,
        type: { type: String, enum: ['text', 'image'], default: 'text' },
        timestamp: { type: Date, default: Date.now }
    }],
    pinnedChats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    archivedChats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    mutedChats: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    lastSeen: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);
