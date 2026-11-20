document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const videoPlayer = document.getElementById('video-player');
    const placeholder = document.getElementById('video-placeholder');
    const placeholderText = document.getElementById('placeholder-text');
    const statusBadge = document.getElementById('status-badge');
    const screenShareBtn = document.getElementById('screen-share-btn');
    const muteBtn = document.getElementById('mute-btn');
    const pauseBtn = document.getElementById('pause-btn');
    const fullscreenBtn = document.getElementById('fullscreen-btn');
    const shareBox = document.getElementById('share-box');
    const shareLinkInput = document.getElementById('share-link-input');
    const copyLinkBtn = document.getElementById('copy-link-btn');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const messagesList = document.getElementById('messages');

    // State
    let peer = null;
    let localStream = null;
    let activeConnections = []; // Data channels for chat
    let isHost = false;
    let roomId = null;

    // Check if user is joining an existing room via URL hash (e.g., #mw-abc123)
    const urlHash = window.location.hash.replace('#', '').trim();
    if (urlHash) {
        roomId = urlHash;
        initViewer(roomId);
    } else {
        // Ready to host
        updateStatus('Ready to Host', 'badge-offline');
    }

    // ──────────────────────────────────────────
    // 1. HOST MODE
    // ──────────────────────────────────────────
    screenShareBtn.addEventListener('click', async () => {
        if (localStream) {
            stopScreenShare();
            return;
        }

        try {
            // Request high-quality 60 FPS screen capture with tab audio
            localStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    frameRate: { ideal: 60, max: 60 }
                },
                audio: true // Captures tab audio if user keeps the checkbox enabled
            });

            // Display locally
            videoPlayer.srcObject = localStream;
            videoPlayer.muted = true; // Mute host's own preview to avoid feedback loop
            await videoPlayer.play();
            placeholder.classList.add('hidden');

            // Handle when user stops sharing via browser's native stop button
            localStream.getVideoTracks()[0].addEventListener('ended', () => {
                stopScreenShare();
            });

            screenShareBtn.textContent = 'Stop Sharing';
            screenShareBtn.classList.remove('btn-primary');
            screenShareBtn.classList.add('btn-danger');

            // Initialize Host Peer if not yet created
            if (!peer) {
                initHost();
            } else {
                // If peer already exists, call all connected viewers with new stream
                activeConnections.forEach(conn => {
                    peer.call(conn.peer, localStream);
                });
            }

        } catch (err) {
            console.error('Failed to get screen stream:', err);
            appendMessage('system', 'Screen sharing was canceled or denied.');
        }
    });

    function initHost() {
        isHost = true;
        // Generate random clean room id
        const hostRoomId = 'mw-' + Math.random().toString(36).substring(2, 8);
        peer = new Peer(hostRoomId);

        updateStatus('Creating Room...', 'badge-offline');

        peer.on('open', (id) => {
            roomId = id;
            updateStatus('Live • Hosting', 'badge-live');

            // Construct full shareable URL
            const shareUrl = `${window.location.origin}${window.location.pathname}#${id}`;
            shareLinkInput.value = shareUrl;
            shareBox.classList.remove('hidden');

            appendMessage('system', `Room created! Copy the link above and send it to your friend.`);
        });

        // When a viewer connects for chat
        peer.on('connection', (conn) => {
            setupChatConnection(conn);

            // Once data connection opens, call the viewer with our screen stream
            conn.on('open', () => {
                appendMessage('system', 'A friend joined your room!');
                updateStatus('Live • Friend Connected', 'badge-connected');
                if (localStream) {
                    peer.call(conn.peer, localStream);
                }
            });
        });

        peer.on('error', (err) => {
            console.error('Host peer error:', err);
            appendMessage('system', `Connection notice: ${err.type}`);
        });
    }

    function stopScreenShare() {
        if (localStream) {
            localStream.getTracks().forEach(t => t.stop());
            localStream = null;
        }
        videoPlayer.srcObject = null;
        placeholder.classList.remove('hidden');
        placeholderText.textContent = 'Screen share stopped';
        screenShareBtn.textContent = 'Start Screen Share';
        screenShareBtn.classList.remove('btn-danger');
        screenShareBtn.classList.add('btn-primary');
        updateStatus('Ready to Host', 'badge-offline');
        appendMessage('system', 'You stopped screen sharing.');
    }

    // ──────────────────────────────────────────
    // 2. VIEWER MODE
    // ──────────────────────────────────────────
    function initViewer(hostId) {
        isHost = false;
        // Viewer gets their own random peer ID and connects to Host
        peer = new Peer();

        screenShareBtn.style.display = 'none'; // Viewer doesn't share
        placeholderText.textContent = 'Connecting to host...';
        updateStatus('Connecting...', 'badge-offline');

        peer.on('open', () => {
            appendMessage('system', `Connecting to host room: ${hostId}...`);

            // Connect to host for chat data
            const conn = peer.connect(hostId);
            setupChatConnection(conn);

            conn.on('open', () => {
                updateStatus('Connected to Host', 'badge-connected');
                placeholderText.textContent = 'Waiting for host to share screen...';
                appendMessage('system', 'Connected! Waiting for host to start video.');
            });

            conn.on('close', () => {
                updateStatus('Host Disconnected', 'badge-offline');
                appendMessage('system', 'The host has left the room.');
            });
        });

        // Answer incoming stream from Host
        peer.on('call', (call) => {
            call.answer(); // Viewer doesn't send media back

            call.on('stream', (remoteStream) => {
                videoPlayer.srcObject = remoteStream;
                videoPlayer.muted = false; // Unmuted for viewer
                videoPlayer.play().catch(e => {
                    console.warn('Autoplay blocked by browser. Click to play.');
                    placeholderText.textContent = 'Click video to unmute & play';
                    placeholder.classList.remove('hidden');
                });
                placeholder.classList.add('hidden');
                updateStatus('Watching Live', 'badge-live');
                appendMessage('system', 'Receiving live video stream!');
            });
        });

        peer.on('error', (err) => {
            console.error('Viewer peer error:', err);
            updateStatus('Connection Error', 'badge-offline');
            appendMessage('system', `Could not connect to host. Make sure the link is correct.`);
        });
    }

    // ──────────────────────────────────────────
    // 3. REAL-TIME CHAT
    // ──────────────────────────────────────────
    function setupChatConnection(conn) {
        activeConnections.push(conn);

        conn.on('data', (data) => {
            if (data && data.text) {
                appendMessage('friend', data.text, data.sender || 'Friend');
            }
        });

        conn.on('close', () => {
            activeConnections = activeConnections.filter(c => c !== conn);
        });
    }

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (!text) return;

        // Display locally
        appendMessage('me', text, 'You');
        messageInput.value = '';

        // Broadcast to all connected peers
        activeConnections.forEach(conn => {
            if (conn.open) {
                conn.send({
                    text: text,
                    sender: isHost ? 'Host' : 'Friend'
                });
            }
        });
    });

    function appendMessage(type, text, author = '') {
        const li = document.createElement('li');
        if (type === 'me') {
            li.className = 'msg-me';
            li.innerHTML = `<span class="msg-author">${escapeHtml(author)}</span>${escapeHtml(text)}`;
        } else if (type === 'friend') {
            li.className = 'msg-friend';
            li.innerHTML = `<span class="msg-author">${escapeHtml(author)}</span>${escapeHtml(text)}`;
        } else {
            li.className = 'system-msg';
            li.textContent = text;
        }
        messagesList.appendChild(li);
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
        })[m]);
    }

    // ──────────────────────────────────────────
    // 4. PLAYER CONTROLS
    // ──────────────────────────────────────────
    muteBtn.addEventListener('click', () => {
        videoPlayer.muted = !videoPlayer.muted;
        muteBtn.textContent = videoPlayer.muted ? 'Unmute' : 'Mute';
    });

    pauseBtn.addEventListener('click', () => {
        if (videoPlayer.paused) {
            videoPlayer.play();
            pauseBtn.textContent = 'Pause';
        } else {
            videoPlayer.pause();
            pauseBtn.textContent = 'Resume';
        }
    });

    fullscreenBtn.addEventListener('click', () => {
        const container = document.getElementById('video-container');
        if (!document.fullscreenElement) {
            container.requestFullscreen().catch(err => {
                console.error('Fullscreen request failed:', err);
            });
        } else {
            document.exitFullscreen();
        }
    });

    // Copy Room Link button
    copyLinkBtn.addEventListener('click', () => {
        shareLinkInput.select();
        navigator.clipboard.writeText(shareLinkInput.value).then(() => {
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(() => { copyLinkBtn.textContent = 'Copy Link'; }, 2000);
        });
    });

    function updateStatus(text, badgeClass) {
        statusBadge.textContent = text;
        statusBadge.className = `badge ${badgeClass}`;
    }
});
