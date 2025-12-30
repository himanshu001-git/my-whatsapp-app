const socket = io('http://localhost:5001');
const apiBase = 'http://localhost:5001/api';

let currentUser = null;
let selectedUser = null;
let typingTimeout = null;
let onlineUsers = [];
let lastSeenMap = {};


// DOM Elements
// DOM Elements
const loginScreen = document.getElementById('login-screen');
const usernameInput = document.getElementById('username-input');
const loginBtn = document.getElementById('login-btn');

const chatList = document.getElementById('chat-list');
const chatArea = document.getElementById('chat-area');
const chatHeader = document.getElementById('chat-header');
const messagesContainer = document.getElementById('messages-container');
let messageInput = document.getElementById('message-input');

// Filter State
let currentFilter = 'all'; // all, unread, favorites, groups

function toggleFilterMenu() {
    const menu = document.getElementById('filter-menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

function applyFilter(filter) {
    currentFilter = filter;
    document.getElementById('filter-menu').style.display = 'none';
    loadUsers();
}

// Close Filter Menu on Outside Click
document.addEventListener('click', (e) => {
    const menu = document.getElementById('filter-menu');
    const icon = document.querySelector('.nav-icons .lucide-more-vertical'); // Approximation
    // Use target.closest for icon if possible, but basic exclusion works
    // We need to attach the ref to the icon
    if (menu && menu.style.display === 'block' && !menu.contains(e.target) && !e.target.closest('.lucide-more-vertical')) {
        menu.style.display = 'none';
    }
});

// Emoji Picker
const picker = document.createElement('emoji-picker');
picker.style.position = 'absolute';
picker.style.bottom = '70px';
picker.style.left = '20px';
picker.style.display = 'none';
picker.style.zIndex = '100';
document.getElementById('app').appendChild(picker);

picker.addEventListener('emoji-click', event => {
    const input = document.getElementById('message-input');
    if (input) {
        input.value += event.detail.unicode;
        input.focus();
    }
});

function toggleEmoji() {
    picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}

// File Upload Logic
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch(`${apiBase}/upload`, {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        return data.filePath;
    } catch (err) {
        console.error('Upload Error', err);
        return null;
    }
}

// Status Upload
document.getElementById('status-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
        const path = await uploadFile(file);
        if (path) {
            // Update UI
            document.getElementById('my-status-img').src = path;
            document.getElementById('my-status-img').setAttribute('data-status-url', path);
            alert('Status uploaded!');
        }
    }
});

// Profile Picture Upload
document.getElementById('profile-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file && currentUser) {
        const path = await uploadFile(file); // e.g., /uploads/filename.jpg
        if (path) {
            // Update User in DB
            try {
                const res = await fetch(`${apiBase}/auth/profile/${currentUser._id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ avatar: path })
                });

                if (res.ok) {
                    const updatedUser = await res.json();
                    currentUser = updatedUser;
                    document.getElementById('my-profile-img').src = path;
                    alert('Profile picture updated!');
                    // Removed status sync to make them work independently
                } else {
                    alert('Failed to update profile');
                }
            } catch (err) {
                console.error(err);
                alert('Error updating profile');
            }
        }
    }
});

function viewStatus() {
    const img = document.getElementById('my-status-img');
    const url = img.getAttribute('data-status-url') || img.src;

    // Check if it's the default placeholder, if so, nothing to view
    if (url.includes('pravatar') || url.includes('placeholder')) return alert('No status uploaded!');

    document.getElementById('status-view-modal').style.display = 'flex';
    document.getElementById('status-view-img').src = url;
}

function deleteStatus() {
    // Reset to default
    document.getElementById('my-status-img').src = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png?20150327203541';
    document.getElementById('my-status-img').removeAttribute('data-status-url');
    document.getElementById('status-view-modal').style.display = 'none';
    alert('Status deleted!');
}

// Login Logic
loginBtn.addEventListener('click', async () => {
    const username = usernameInput.value.trim();
    if (!username) return alert('Please enter a username');

    // Try login (or signup automatically for simplicity)
    try {
        let res = await fetch(`${apiBase}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password: 'password' }) // Hardcoded for demo
        });

        if (res.status === 404) {
            // User not found, try signup
            res = await fetch(`${apiBase}/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password: 'password' })
            });
        }

        if (res.ok) {
            currentUser = await res.json();
            loginScreen.style.display = 'none';
            loginScreen.style.display = 'none';
            socket.emit('join', currentUser._id);
            loadUsers();

            // Show status bar
            document.getElementById('status-bar').style.display = 'flex';
            const defaultAvatar = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png?20150327203541';
            const userAvatar = currentUser.avatar ? currentUser.avatar : defaultAvatar;
            document.getElementById('my-status-img').src = userAvatar;
            document.getElementById('my-profile-img').src = userAvatar;
        } else {
            alert('Login failed');
        }
    } catch (err) {
        console.error('Login error:', err);
    }
});

// Load Sidebar Users
// Load Sidebar Users
// Load Sidebar Users
// Load Sidebar Chats (Users + Groups)
async function loadUsers() {
    try {
        const [usersRes, groupsRes] = await Promise.all([
            fetch(`${apiBase}/auth/users`),
            fetch(`${apiBase}/group/mygroups/${currentUser._id}`)
        ]);

        let users = await usersRes.json();
        let groups = await groupsRes.json();

        // 1. Populate New Chat Drawer List (Contacts)
        const newChatList = document.getElementById('new-chat-list');
        if (newChatList) {
            newChatList.innerHTML = '';
            users.forEach(user => {
                if (user._id === currentUser._id) return;
                const div = document.createElement('div');
                div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.gap = '15px'; div.style.padding = '10px 0'; div.style.cursor = 'pointer'; div.style.borderBottom = '1px solid #202c33';
                div.onclick = () => { selectUser(user); document.getElementById('new-chat-drawer').style.left = '-100%'; };

                const defaultAvatar = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png?20150327203541';
                const userAvatar = user.avatar || defaultAvatar;

                div.innerHTML = `
                    <img src="${userAvatar}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;">
                    <div style="flex:1;">
                        <h4 style="margin:0; font-weight: 500; font-size: 16px; color: #e9edef;">${user.username}</h4>
                        <p style="margin:0; font-size: 13px; color: #8696a0;">${user.status || 'Available'}</p>
                    </div>
                `;
                newChatList.appendChild(div);
            });
        }

        // Populate Group Participant Selection List
        const groupPartList = document.getElementById('group-participants-list');
        if (groupPartList) {
            groupPartList.innerHTML = '';
            users.forEach(user => {
                if (user._id === currentUser._id) return;
                const div = document.createElement('div');
                div.className = 'group-candidate';
                div.style.display = 'flex'; div.style.alignItems = 'center'; div.style.gap = '15px'; div.style.padding = '10px'; div.style.borderBottom = '1px solid #202c33';

                div.innerHTML = `
                    <input type="checkbox" value="${user._id}" style="width:18px; height:18px; accent-color:#00a884;">
                    <img src="${user.avatar || 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png'}" style="width: 40px; height: 40px; border-radius: 50%;">
                    <span style="color: #e9edef; font-size: 16px;">${user.username}</span>
                `;
                groupPartList.appendChild(div);
            });
        }

        // 2. Filter Main Chat List (Users + Groups)
        // Normalize objects for display
        const userChats = users.filter(u => u._id !== currentUser._id).map(u => ({ ...u, isGroup: false }));
        const groupChats = groups.map(g => ({ ...g, _id: g._id, username: g.name, avatar: g.avatar, status: '', isGroup: true }));

        let allChats = [...userChats, ...groupChats];

        const pinnedIds = currentUser.pinnedChats || [];
        // Filter logic
        if (currentFilter === 'favorites') {
            const favIds = currentUser.favorites || [];
            allChats = allChats.filter(c => favIds.includes(c._id));
        } else if (currentFilter === 'unread') {
            allChats = [];
        } else if (currentFilter === 'groups') {
            allChats = allChats.filter(c => c.isGroup);
        }

        chatList.innerHTML = '';

        // Sorting: Pinned first, then simplified
        allChats.sort((a, b) => {
            const aPinned = pinnedIds.includes(a._id);
            const bPinned = pinnedIds.includes(b._id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return 0; // Ideally sort by date
        });

        if (allChats.length === 0) {
            chatList.innerHTML = `<div style="padding:20px; text-align:center; color:#8696a0;">No chats found</div>`;
        }

        allChats.forEach(chat => {
            const div = document.createElement('div');
            div.className = 'chat-item';
            const isPinned = pinnedIds.includes(chat._id);
            if (isPinned) div.classList.add('pinned');

            div.onclick = () => selectUser(chat); // selectUser handles both via isGroup check
            div.oncontextmenu = (e) => {
                e.preventDefault();
                showChatContextMenu(e, chat, isPinned);
            };

            const defaultAvatar = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png?20150327203541';
            const userAvatar = chat.avatar ? chat.avatar : defaultAvatar;
            const pinIcon = isPinned ? '<i data-lucide="pin" style="width:12px; height:12px; transform: rotate(45deg); color:#00a884;"></i>' : '';

            div.innerHTML = `
                <div class="avatar">
                    <img src="${userAvatar}" alt="${chat.username}">
                </div>
                <div class="chat-info">
                    <div class="chat-name">
                        <h4>${chat.username}</h4>
                        <span class="time">${pinIcon}</span>
                    </div>
                    <div class="chat-preview">
                        <p class="status">${chat.isGroup ? 'Group' : chat.status}</p>
                    </div>
                </div>
            `;
            chatList.appendChild(div);
        });
        lucide.createIcons();

        // Update New Chat Drawer "New Group" click
        const newGroupBtn = document.querySelector('#new-chat-drawer .lucide-users').parentElement.parentElement;
        if (newGroupBtn) newGroupBtn.onclick = openNewGroupState;

    } catch (err) {
        console.error('Error loading chats:', err);
    }
}

// Group Creation State
function openNewGroupState() {
    document.getElementById('new-group-drawer').style.left = '0';
    // Reset checks
    document.querySelectorAll('.group-candidate input').forEach(cb => cb.checked = false);
}

let selectedGroupMembers = [];

function showGroupInfoStep() {
    // Collect checked members
    selectedGroupMembers = Array.from(document.querySelectorAll('.group-candidate input:checked')).map(cb => cb.value);
    if (selectedGroupMembers.length === 0) return alert('Please select at least 1 participant');

    document.getElementById('group-info-drawer').style.left = '0';
}

async function createGroup() {
    const subject = document.getElementById('group-subject-input').value.trim();
    if (!subject) return alert('Please enter a group subject');

    try {
        const res = await fetch(`${apiBase}/group/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: subject,
                members: selectedGroupMembers,
                adminId: currentUser._id
            })
        });

        if (res.ok) {
            alert('Group created!');
            // Reset drawers
            document.getElementById('group-info-drawer').style.left = '-100%';
            document.getElementById('new-group-drawer').style.left = '-100%';
            document.getElementById('new-chat-drawer').style.left = '-100%';
            loadUsers(); // Reload to show group
        } else {
            alert('Failed to create group');
        }
    } catch (e) { console.error(e); }
}

// Select Chat (User or Group)
// We reuse selectUser name, but handle isGroup logic
async function selectUser(chat) {
    selectedUser = chat; // selectedUser now can be an object with isGroup: true

    // Update Chat Area Headers
    renderChatArea(chat);

    // Load History
    const url = chat.isGroup
        ? `${apiBase}/group/${chat._id}/messages`
        : `${apiBase}/chat/${currentUser._id}/${chat._id}`;

    const res = await fetch(url);
    const messages = await res.json();
    renderMessages(messages);

    if (!chat.isGroup) {
    socket.emit('message_seen', {
        sender: chat._id,
        receiver: currentUser._id
    });
}

    if (chat.isGroup) {
        socket.emit('join_group', chat._id);
    }
    updateOnlineStatus();
}

// Chat Context Menu Helper
function showChatContextMenu(e, user, isPinned) {
    const existing = document.getElementById('chat-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'chat-context-menu';
    menu.style.position = 'fixed';
    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;
    menu.style.backgroundColor = '#233138';
    menu.style.border = '1px solid #111b21';
    menu.style.borderRadius = '5px';
    menu.style.zIndex = '2000';
    menu.style.color = '#e9edef';
    menu.style.cursor = 'pointer';
    menu.style.minWidth = '150px';

    const pinText = isPinned ? 'Unpin chat' : 'Pin chat';

    menu.innerHTML = `
        <div style="padding: 10px 15px; border-bottom: 1px solid #111b21;" onclick="togglePin('${user._id}'); this.parentElement.remove();">${pinText}</div>
        <div style="padding: 10px 15px;" onclick="alert('Select user first to delete chat via main menu (safety)'); this.parentElement.remove();">Delete chat</div>
    `;
    // For delete, ideally we trigger it directly, but let's just make it simple
    // Replacing alert with logic if current selected user is this user

    document.body.appendChild(menu);

    const closeMenu = () => { menu.remove(); document.removeEventListener('click', closeMenu); };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// Select User to Chat
// Duplicate selectUser removed

// --- Advanced UI functions ---

function toggleProfile() {
    const sidebar = document.getElementById('right-sidebar');
    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
        sidebar.classList.remove('open');
    } else {
        sidebar.classList.add('open');
        renderProfileInfo();
    }
}
function renderProfileInfo() {
    if (!selectedUser) return;

    const defaultAvatar =
        'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png';

    const sidebar = document.getElementById('right-sidebar');
    sidebar.innerHTML = `
        <div class="profile-header">
            <img src="${selectedUser.avatar || defaultAvatar}" alt="Profile">
            <h2 style="color: var(--text-primary); font-weight: 400;">
                ${selectedUser.username}
            </h2>
            <p style="color: var(--text-secondary);">
                ${selectedUser.phone || ' '}
            </p>
        </div>

        <!-- ABOUT / BIO -->
        <div class="profile-section">
            <h5>About</h5>
            <p>
                ${selectedUser.about || 'Hey there! I am using WhatsApp.'}
            </p>
        </div>

        <!-- STATUS -->
        <div class="profile-section">
            <h5>Status</h5>
            <p style="color:#8696a0;">
                ${selectedUser.status || 'Available'}
            </p>
        </div>

        <!-- MEDIA INFO -->
        <div class="profile-section">
            <h5>Media, Links and Docs</h5>
            <p style="color: var(--text-secondary); font-size: 14px;">
                0 Media • 0 Links • 0 Docs
            </p>
        </div>

        <!-- BLOCK -->
        <div class="profile-section" 
             style="cursor:pointer; color:#ea0038"
             onclick="alert('Block user logic here')">
            Block ${selectedUser.username}
        </div>
    `;
}


// --- Call Logic ---
let localStream;
let peerConnection;
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function startCall(type) {
    if (!selectedUser) return;

    // Get Local Stream
    try {
        const constraints = type === 'video' ? { audio: true, video: true } : { audio: true, video: false };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);

        // If video, show local video, else show avatar or placeholder
        const localVideo = document.getElementById('local-video');
        if (type === 'video') {
            localVideo.srcObject = localStream;
            localVideo.style.display = 'block';
        } else {
            localVideo.style.display = 'none';
        }
    } catch (e) {
        console.error('Error accessing media', e);
        return alert('Could not access camera/mic');
    }

    // Show UI Overlay
    document.getElementById('call-overlay').style.display = 'flex';
    document.getElementById('call-ui-name').innerText = selectedUser.username + ' (Calling...)';

    // Init Peer
    createPeerConnection();

    // Add tracks
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Create Offer
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socket.emit('call_user', {
        userToCall: selectedUser._id,
        signalData: offer,
        from: currentUser._id,
        name: currentUser.username
    });
}


function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            // We could send candidates individually, but simpler demo sends full SDP usually.
            // However, standard webrtc needs candidate exchange.
            socket.emit('ice_candidate', { target: selectedUser._id || incomingCallData.from, candidate: event.candidate });
        }
    };

    peerConnection.ontrack = (event) => {
        const remoteVideo = document.getElementById('remote-video');
        if (remoteVideo.srcObject !== event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
        }
    };
}

// Handle ICE Candidates from remote
socket.on('ice_candidate', async (data) => {
    try {
        if (peerConnection) await peerConnection.addIceCandidate(data.candidate);
    } catch (e) { }
});

function endCall() {
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    if (peerConnection) peerConnection.close();

    document.getElementById('call-overlay').style.display = 'none';
    document.getElementById('incoming-call-modal').style.display = 'none';
    socket.emit('end_call', { to: selectedUser ? selectedUser._id : incomingCallData.from });
}

let incomingCallData = null;

socket.on('call_user', (data) => {
    incomingCallData = data;
    document.getElementById('incoming-call-modal').style.display = 'flex';
    document.getElementById('incoming-call-name').innerText = `${data.name} is calling...`;

    // Note: We don't have avatar logic fully wired for calls yet
});

async function acceptCall() {
    document.getElementById('incoming-call-modal').style.display = 'none';
    document.getElementById('call-overlay').style.display = 'flex';

    // Get Local Stream
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        document.getElementById('local-video').srcObject = localStream;
    } catch (e) { console.error(e); }

    createPeerConnection();
    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

    // Set Remote Desc
    await peerConnection.setRemoteDescription(incomingCallData.signal);

    // Create Answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer_call', { signal: answer, to: incomingCallData.from });
}

function rejectCall() {
    document.getElementById('incoming-call-modal').style.display = 'none';
    // optionally emit reject
}

socket.on('call_accepted', async (signal) => {
    await peerConnection.setRemoteDescription(signal);
    document.getElementById('call-ui-status').innerText = 'Connected';
});


socket.on('call_ended', () => {
    document.getElementById('call-overlay').style.display = 'none';
    alert('Call ended');
});


function renderChatArea(user) {
    const defaultAvatar = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png?20150327203541';
    const userAvatar = user.avatar ? user.avatar : defaultAvatar;

    // Dynamic HTML injection for chat header and input
    chatArea.innerHTML = `
        <div class="chat-header" onclick="toggleProfile()" style="cursor: pointer;">
            <div class="avatar">
                <img src="${userAvatar}" alt="">
            </div>
            <div class="chat-header-info">
                <h4>${user.username}</h4>
                <p>click here for contact info</p>
            </div>
            <div class="nav-icons" onclick="event.stopPropagation()">
                <i data-lucide="search"></i>
                <i data-lucide="phone" onclick="startCall('voice')"></i>
                <i data-lucide="video" onclick="startCall('video')"></i>
                <i data-lucide="trash-2" onclick="deleteChat()" style="cursor: pointer;" title="Delete Chat"></i>
            </div>
        </div>
        
        <div class="messages-container" id="messages-container"></div>
        
        <div class="chat-input-area">
            <i data-lucide="smile" onclick="toggleEmoji()"></i>
            <i data-lucide="paperclip" onclick="document.getElementById('chat-file-input').click()"></i>
            <input type="file" id="chat-file-input" style="display:none" onchange="sendMessage()">
            <input type="text" id="message-input" placeholder="Type a message">
            <i data-lucide="mic"></i>
        </div>
    `;
    lucide.createIcons();

    // Re-attach input listener
    const input = document.getElementById('message-input');
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
    input.addEventListener('input', () => {
    if (!selectedUser) return;

    socket.emit('typing', {
        sender: currentUser._id,
        receiver: selectedUser._id
    });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('stop_typing', {
            sender: currentUser._id,
            receiver: selectedUser._id
        });
    }, 1200);
});

}

function renderMessages(messages) {
    const container = document.getElementById('messages-container');
    container.innerHTML = '';
    messages.forEach(msg => appendMessage(msg));
    scrollToBottom();
}

function appendMessage(msg) {
    const container = document.getElementById('messages-container');
    const div = document.createElement('div');
    const isMe = msg.sender === currentUser._id;

        // 🔴 DELETE FOR EVERYONE (DB BASED – MUST BE FIRST)
    if (msg.deletedForEveryone) {
        const deletedDiv = document.createElement('div');
        deletedDiv.className = `message ${isMe ? 'outgoing' : 'incoming'}`;
        deletedDiv.innerHTML = `
            <div class="msg-bubble" data-id="${msg._id}">
                <p style="font-style: italic; color:#8696a0">
                    This message was deleted
                </p>
            </div>
        `;
        container.appendChild(deletedDiv);
        scrollToBottom();
        return; // ⛔ very important
    }

        // 👉 RIGHT CLICK DELETE MENU
    div.oncontextmenu = (e) => {
        e.preventDefault();
        showMessageContextMenu(e, msg);
    };


    div.className = `message ${isMe ? 'outgoing' : 'incoming'}`;

    let bubbleContent = `<p>${msg.content}</p>`;
    if (msg.type === 'image') {
        bubbleContent = `<img src="${msg.content}" style="max-width: 200px; border-radius: 8px;">`;
    } else if (msg.type === 'video') {
        bubbleContent = `<video src="${msg.content}" controls style="max-width: 200px; border-radius: 8px;"></video>`;
    }

   div.innerHTML = `
    <div class="msg-bubble" data-id="${msg._id}">
        ${bubbleContent}

        <div class="msg-meta">
            <span class="msg-time">
                ${new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>

            ${isMe ? `
                <span class="msg-tick ${msg.status === 'seen' ? 'seen' : ''}">
                    ${msg.status === 'sent' ? '✓' : '✓✓'}
                </span>
            ` : ''}
        </div>
    </div>
`;

    container.appendChild(div);
    scrollToBottom();
}

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    if (container) container.scrollTop = container.scrollHeight;
}

// Send Message
// Send Message
async function sendMessage() {
    const input = document.getElementById('message-input');
    const content = input ? input.value.trim() : '';

    // Check if there is an attachment
    const fileInput = document.getElementById('chat-file-input'); // Dynamically added
    let mediaUrl = null;
    let messageType = 'text';

    if (fileInput && fileInput.files.length > 0) {
        const file = fileInput.files[0];
        mediaUrl = await uploadFile(file);
        messageType = file.type.startsWith('image/') ? 'image' : 'video';
    }

    if (!content && !mediaUrl) return;

    if (!selectedUser) return;

   // SEND MESSAGE (FIXED)
socket.emit('sendMessage', {
    sender: currentUser._id,
    receiver: selectedUser._id,
    content: mediaUrl || content,
    type: messageType,
    status: 'sent',
    createdAt: new Date()
});


    // Clear inputs
    if (input) input.value = '';
    if (fileInput) fileInput.value = '';
}

// Socket Listeners
socket.on('receiveMessage', (msg) => {
    console.log('Message received:', msg);

    if (!selectedUser) return;

    // Private chat
    if (
        !selectedUser.isGroup &&
        (msg.sender === selectedUser._id || msg.sender === currentUser._id)
    ) {
        appendMessage(msg);
    }

    // Group chat
    if (selectedUser.isGroup && msg.groupId === selectedUser._id) {
        appendMessage(msg);
    }
});

// 🔴 ONLINE USERS LIST
socket.on('online_users', (users) => {
    onlineUsers = users;
    updateOnlineStatus();
});

// 🔴 USER OFFLINE (LAST SEEN)
socket.on('user_offline', ({ userId, lastSeen }) => {
    lastSeenMap[userId] = lastSeen;
    updateOnlineStatus();
});



// --- New Features Logic ---

// Search Logic
const sidebarSearchInput = document.querySelector('.search-input input');
if (sidebarSearchInput) {
    sidebarSearchInput.addEventListener('input', (e) => {
        const term = e.target.value.toLowerCase();
        const allItems = document.querySelectorAll('#chat-list .chat-item');
        allItems.forEach(item => {
            const nameHeader = item.querySelector('.chat-name h4');
            if (nameHeader) {
                const name = nameHeader.innerText.toLowerCase();
                item.style.display = name.includes(term) ? 'flex' : 'none';
            }
        });
    });
}

// Unified Action Helper
async function toggleAction(targetId, type, action) {
    if (!currentUser) return;
    try {
        const res = await fetch(`${apiBase}/chat/action`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: currentUser._id, targetId, type, action })
        });
        const updatedUser = await res.json();
        currentUser = updatedUser; // Update local state
        loadUsers(); // Reload list
    } catch (e) { console.error(e); }
}

// 1. Profile Context Menu
function toggleProfileMenu() {
    const menu = document.getElementById('profile-context-menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

// Close menu if clicked outside
document.addEventListener('click', (e) => {
    const menu = document.getElementById('profile-context-menu');
    const avatar = document.getElementById('my-profile-container');
    if (menu && avatar && !avatar.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = 'none';
    }
});

function triggerProfileUpload() {
    document.getElementById('profile-upload').click();
    document.getElementById('profile-context-menu').style.display = 'none';
}

function viewMyProfile() {
    const src = document.getElementById('my-profile-img').src;
    document.getElementById('status-view-img').src = src;
    document.getElementById('status-view-modal').style.display = 'flex';
    document.getElementById('profile-context-menu').style.display = 'none';
}

async function removeProfilePicture() {
    if (!currentUser) return;
    if (!confirm('Remove profile picture?')) return;

    try {
        const res = await fetch(`${apiBase}/auth/profile/${currentUser._id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar: '' }) // Send empty string
        });
        if (res.ok) {
            const updated = await res.json();
            currentUser = updated;
            const defaultAvatar = 'https://upload.wikimedia.org/wikipedia/commons/7/7c/Profile_avatar_placeholder_large.png?20150327203541';
            document.getElementById('my-profile-img').src = defaultAvatar;
            document.getElementById('my-status-img').src = defaultAvatar;
            alert('Profile picture removed');
        }
    } catch (e) {
        console.error(e);
    }
    document.getElementById('profile-context-menu').style.display = 'none';
}

// 2. Chat Context Menu (Pin/Delete/etc)
// Legacy helpers are replaced by toggleAction in menu, but keeping these for reference or other calls
async function togglePin(targetId) {
    const isPinned = currentUser.pinnedChats && currentUser.pinnedChats.includes(targetId);
    toggleAction(targetId, 'pin', isPinned ? 'remove' : 'add');
}

async function deleteChat() {
    if (!selectedUser) return;
    if (!confirm(`Delete all messages with ${selectedUser.username}?`)) return;

    try {
        await fetch(`${apiBase}/chat/${currentUser._id}/${selectedUser._id}`, { method: 'DELETE' });
        document.getElementById('messages-container').innerHTML = '';
        alert('Chat cleared');
    } catch (e) { console.error(e); }
}

async function clearChat(targetId) {
    if (!confirm(`Clear all messages?`)) return;
    try {
        await fetch(`${apiBase}/chat/${currentUser._id}/${targetId}`, { method: 'DELETE' });
        if (selectedUser && selectedUser._id === targetId) {
            document.getElementById('messages-container').innerHTML = '';
        }
        alert('Messages cleared');
    } catch (e) { console.error(e); }
}

// Chat Context Menu Helper
function showChatContextMenu(e, user, isPinned) {
    const existing = document.getElementById('chat-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'chat-context-menu';
    menu.style.position = 'fixed';
    menu.style.top = `${e.clientY}px`;
    menu.style.left = `${e.clientX}px`;
    menu.style.backgroundColor = '#233138';
    menu.style.border = '1px solid #111b21';
    menu.style.borderRadius = '6px';
    menu.style.zIndex = '2000';
    menu.style.color = '#e9edef';
    menu.style.cursor = 'pointer';
    menu.style.minWidth = '220px';
    menu.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';
    menu.style.fontSize = '14.5px';
    menu.style.padding = '8px 0';

    const isFav = currentUser.favorites && currentUser.favorites.includes(user._id);
    const isMuted = currentUser.mutedChats && currentUser.mutedChats.includes(user._id);
    const isArchived = currentUser.archivedChats && currentUser.archivedChats.includes(user._id);

    const item = (icon, text, onClick, color) => `
        <div class="ctx-item" onclick="${onClick}; this.parentElement.remove();" 
             style="padding: 10px 24px; display: flex; align-items: center; gap: 12px; color: ${color || '#e9edef'};">
            <i data-lucide="${icon}" style="width: 18px; height: 18px; color: ${color || '#8696a0'};"></i>
            <span>${text}</span>
        </div>
    `;

    menu.innerHTML = `
        ${item('message-square', 'Mark as unread', "alert('Mark as unread: Visual only')")}
        ${item('pin', isPinned ? 'Unpin chat' : 'Pin to top', `toggleAction('${user._id}', 'pin', '${isPinned ? 'remove' : 'add'}')`)}
        ${item('heart', isFav ? 'Remove from favorites' : 'Add to favorites', `toggleAction('${user._id}', 'favorite', '${isFav ? 'remove' : 'add'}')`)}
        ${item(isMuted ? 'volume-2' : 'volume-x', isMuted ? 'Unmute' : 'Mute', `toggleAction('${user._id}', 'mute', '${isMuted ? 'remove' : 'add'}')`)}
        ${item('archive', isArchived ? 'Unarchive' : 'Archive', `toggleAction('${user._id}', 'archive', '${isArchived ? 'remove' : 'add'}')`)}
        ${item('eraser', 'Clear messages', `clearChat('${user._id}')`)}
        ${item('trash-2', 'Delete', `deleteChat()`, '#ea0038')} 
        <div style="height:1px; background:#374045; margin: 4px 0;"></div>
        ${item('external-link', 'Pop-out chat', "alert('Pop-out coming soon')")}
        ${item('x-circle', 'Close chat', "selectedUser = null; renderChatArea();")}
    `;

    document.body.appendChild(menu);
    lucide.createIcons();

    const items = menu.querySelectorAll('.ctx-item');
    items.forEach(div => {
        div.addEventListener('mouseenter', () => div.style.backgroundColor = '#111b21');
        div.addEventListener('mouseleave', () => div.style.backgroundColor = 'transparent');
    });

    const closeMenu = () => { menu.remove(); document.removeEventListener('click', closeMenu); };
    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

// ================= ONLINE / LAST SEEN UI =================
function updateOnlineStatus() {
    if (!selectedUser) return;

    const header = document.querySelector('.chat-header-info p');
    if (!header) return;

    // 🟢 ONLINE
    if (onlineUsers.includes(selectedUser._id)) {
        header.innerText = 'online';
        header.style.color = '#00a884';
        return;
    }

    // ⚫ LAST SEEN
    if (lastSeenMap[selectedUser._id]) {
        const time = new Date(lastSeenMap[selectedUser._id])
            .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        header.innerText = `last seen at ${time}`;
        header.style.color = '#8696a0';
    } else {
        header.innerText = 'offline';
        header.style.color = '#8696a0';
    }
}

socket.on('message_status', ({ messageId, status }) => {
    const tick = document.querySelector(
        `.msg-bubble[data-id="${messageId}"] .msg-tick`
    );
    if (!tick) return;

    if (status === 'delivered') {
        tick.innerText = '✓✓';
        tick.classList.remove('seen');
    }

    if (status === 'seen') {
        tick.innerText = '✓✓';
        tick.classList.add('seen');
    }
});

// ✍️ TYPING INDICATOR (RECEIVE)
socket.on('typing', ({ sender }) => {
    if (!selectedUser || selectedUser._id !== sender) return;

    const header = document.querySelector('.chat-header-info p');
    if (header) {
        header.innerText = 'typing...';
        header.style.color = '#00a884';
    }
});

socket.on('stop_typing', ({ sender }) => {
    if (!selectedUser || selectedUser._id !== sender) return;
    updateOnlineStatus();
});

// ================= MESSAGE CONTEXT MENU (IMPROVED UX) =================

function showMessageContextMenu(e, msg) {
    e.preventDefault();
    e.stopPropagation();

    // Remove old menu if exists
    const oldMenu = document.getElementById('msg-context-menu');
    if (oldMenu) oldMenu.remove();

    // Backdrop (click outside to close)
    const backdrop = document.createElement('div');
    backdrop.id = 'msg-menu-backdrop';
    backdrop.style.position = 'fixed';
    backdrop.style.top = 0;
    backdrop.style.left = 0;
    backdrop.style.width = '100vw';
    backdrop.style.height = '100vh';
    backdrop.style.zIndex = 4999;
    backdrop.style.background = 'transparent';

    backdrop.onclick = () => {
        backdrop.remove();
        menu.remove();
    };

    // Menu
    const menu = document.createElement('div');
    menu.id = 'msg-context-menu';
    menu.style.position = 'fixed';
    const bubble = e.target.closest('.msg-bubble');
const rect = bubble.getBoundingClientRect();

const menuWidth = 220;
const menuHeight = 100;

let top = rect.top;
let left;

// outgoing → right side
if (bubble.closest('.outgoing')) {
    left = rect.right + 10;
} 
// incoming → left side
else {
    left = rect.left - menuWidth - 10;
}

// screen se bahar na jaye
if (left < 10) left = 10;
if (left + menuWidth > window.innerWidth) {
    left = window.innerWidth - menuWidth - 10;
}
if (top + menuHeight > window.innerHeight) {
    top = window.innerHeight - menuHeight - 10;
}

menu.style.top = `${top}px`;
menu.style.left = `${left}px`;

    menu.style.background = '#233138';
    menu.style.borderRadius = '10px';
    menu.style.zIndex = 5000;
    menu.style.minWidth = '220px';
    menu.style.color = '#e9edef';
    menu.style.boxShadow = '0 8px 30px rgba(0,0,0,0.5)';
    menu.style.padding = '6px 0';
    menu.style.fontSize = '14.5px';

    const itemStyle = `
        padding: 12px 20px;
        cursor: pointer;
    `;

    menu.innerHTML = `
        <div style="${itemStyle}" 
             onmouseenter="this.style.background='#111b21'"
             onmouseleave="this.style.background='transparent'"
             onclick="deleteForMe('${msg._id}')">
            Delete for me
        </div>

        ${msg.sender === currentUser._id ? `
        <div style="${itemStyle}; color:#ea0038"
             onmouseenter="this.style.background='#111b21'"
             onmouseleave="this.style.background='transparent'"
             onclick="deleteForEveryone('${msg._id}')">
            Delete for everyone
        </div>` : ''}
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(menu);
}
function deleteForMe(messageId) {
    const bubble = document.querySelector(
        `.msg-bubble[data-id="${messageId}"]`
    );
    if (bubble) {
        bubble.innerHTML = `
            <p style="color:#8696a0;font-style:italic">
                This message was deleted
            </p>
        `;
    }
}

function deleteForEveryone(messageId) {
    socket.emit('delete_for_everyone', {
        messageId,
        sender: currentUser._id,
        receiver: selectedUser._id
    });
}

socket.on('message_deleted_everyone', ({ messageId }) => {
    const bubble = document.querySelector(
        `.msg-bubble[data-id="${messageId}"]`
    );
    if (!bubble) return;

    bubble.innerHTML = `
        <p style="font-style: italic; color:#8696a0">
            This message was deleted
        </p>
    `;
});
