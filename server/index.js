const express = require('express');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// ================= MIDDLEWARE =================
app.use(cors());
app.use(express.json());

// ================= ROUTES =================
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/group', require('./routes/group'));
app.use('/api/upload', require('./routes/upload'));

// ================= DB =================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB connected'))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });

// ================= SOCKET LOGIC =================
let onlineUsers = new Map();   // userId -> socketId
let lastSeenMap = new Map();   // userId -> Date

io.on('connection', (socket) => {
    console.log('🟢 User connected:', socket.id);

    // -------- JOIN --------
    socket.on('join', (userId) => {
        onlineUsers.set(userId, socket.id);
        socket.join(userId);
        lastSeenMap.delete(userId);

        io.emit('online_users', Array.from(onlineUsers.keys()));
    });

    // -------- SEND MESSAGE --------
    socket.on('sendMessage', async (data) => {
        try {
            const Message = require('./models/Message');

            const msg = new Message({
                sender: data.sender,
                receiver: data.receiver,
                content: data.content,
                type: data.type || 'text',
                status: 'sent'
            });

            await msg.save();

            // send to both users
            io.to(data.sender).emit('receiveMessage', msg);
            io.to(data.receiver).emit('receiveMessage', msg);

            // ✔✔ delivered
            msg.status = 'delivered';
            await msg.save();

            io.to(data.sender).emit('message_status', {
                messageId: msg._id,
                status: 'delivered'
            });

        } catch (err) {
            console.error(err);
        }
    });

    // -------- MESSAGE SEEN --------
    socket.on('message_seen', async ({ sender, receiver }) => {
        try {
            const Message = require('./models/Message');

            const msgs = await Message.find({
                sender,
                receiver,
                status: { $ne: 'seen' }
            });

            await Message.updateMany(
                { sender, receiver, status: { $ne: 'seen' } },
                { status: 'seen' }
            );

            msgs.forEach(m => {
                io.to(sender).emit('message_status', {
                    messageId: m._id,
                    status: 'seen'
                });
            });

        } catch (err) {
            console.error(err);
        }
    });

    // -------- TYPING INDICATOR (FIXED) --------
    socket.on('typing', ({ sender, receiver }) => {
        io.to(receiver).emit('typing', { sender });
    });

    socket.on('stop_typing', ({ sender, receiver }) => {
        io.to(receiver).emit('stop_typing', { sender });
    });

    // -------- DELETE FOR EVERYONE --------
socket.on('delete_for_everyone', async ({ messageId, sender, receiver }) => {
    try {
        const Message = require('./models/Message');

        await Message.findByIdAndUpdate(messageId, {
            deletedForEveryone: true,
            content: ''
        });

        // notify both users
        io.to(sender).emit('message_deleted_everyone', { messageId });
        io.to(receiver).emit('message_deleted_everyone', { messageId });

    } catch (err) {
        console.error('delete_for_everyone error:', err);
    }
});


    // -------- CALL SIGNALING --------
    socket.on('call_user', (data) => {
        const socketId = onlineUsers.get(data.userToCall);
        if (socketId) {
            io.to(socketId).emit('call_user', data);
        }
    });

    socket.on('answer_call', (data) => {
        const socketId = onlineUsers.get(data.to);
        if (socketId) {
            io.to(socketId).emit('call_accepted', data.signal);
        }
    });

    socket.on('end_call', (data) => {
        const socketId = onlineUsers.get(data.to);
        if (socketId) {
            io.to(socketId).emit('call_ended');
        }
    });

    socket.on('ice_candidate', (data) => {
        const socketId = onlineUsers.get(data.target);
        if (socketId) {
            io.to(socketId).emit('ice_candidate', data);
        }
    });

    // -------- DISCONNECT --------
    socket.on('disconnect', () => {
        let userId = null;

        for (let [uid, sid] of onlineUsers.entries()) {
            if (sid === socket.id) {
                userId = uid;
                onlineUsers.delete(uid);
                break;
            }
        }

        if (userId) {
            const lastSeen = new Date();
            lastSeenMap.set(userId, lastSeen);
            io.emit('user_offline', { userId, lastSeen });
        }

        io.emit('online_users', Array.from(onlineUsers.keys()));
        console.log('🔴 User disconnected:', socket.id);
    });
});

// ================= STATIC =================
app.use(express.static(path.join(__dirname, '../client')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// ================= START =================
const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
