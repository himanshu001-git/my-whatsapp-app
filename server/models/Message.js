const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  content: {
    type: String
  },

  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent'
  },

  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  deletedForEveryone: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });   // 🔥 createdAt + updatedAt auto

module.exports = mongoose.model('Message', messageSchema);
