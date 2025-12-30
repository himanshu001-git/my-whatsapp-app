const mongoose = require('mongoose');

const GroupSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: String,
    avatar: { type: String, default: 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png?20150327203541' },
    admins: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Array of admins
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdAt: { type: Date, default: Date.now },
    lastMessage: { // caching last message for list view
        content: String,
        sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: Date
    }
});

module.exports = mongoose.model('Group', GroupSchema);
