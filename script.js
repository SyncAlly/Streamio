document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const videoPlayer = document.getElementById('video-player');
    const voiceAudio = document.getElementById('voice-audio');
    const placeholder = document.getElementById('video-placeholder');
    const placeholderText = document.getElementById('placeholder-text');
    const statusBadge = document.getElementById('status-badge');
    const screenShareBtn = document.getElementById('screen-share-btn');
    const micBtn = document.getElementById('mic-btn');
    const speakerBtn = document.getElementById('speaker-btn');
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
    let localStream = null;      // Screen share stream
    let localMicStream = null;   // Microphone stream for voice chat
    let micTrack = null;
    let activeConnections = [];  // Data channels for chat
    let isHost = false;
    let roomId = null;
    let connectedPeers = new Set(); // Track remote peer IDs

    // Check if user is joining an existing room via URL hash (e.g., #mw-abc123)
    const urlHash = window.location.hash.replace('#', '').trim();
    if (urlHash) {
        roomId = urlHash;
        initViewer(roomId);
    } else {
        updateStatus('Ready to Host', 'badge-offline');
    }

    // ──────────────────────────────────────────
    // 1. HOST MODE (Screen Share)
    // ──────────────────────────────────────────
    screenShareBtn.addEventListener('click', async () => {
        if (localStream) {
            stopScreenShare();
            return;
        }

        try {
            // High-quality 60 FPS capture with tab audio
            localStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    frameRate: { ideal: 60, max: 60 }
                },
                audio: true // Captures movie/tab audio
            });

            videoPlayer.srcObject = localStream;
            videoPlayer.muted = true; // Mute host's own preview to prevent echo
            await videoPlayer.play();
            placeholder.classList.add('hidden');

            localStream.getVideoTracks()[0].addEventListener('ended', () => {
                stopScreenShare();
            });

            screenShareBtn.textContent = 'Stop Sharing';
            screenShareBtn.classList.remove('btn-primary');
            screenShareBtn.classList.add('btn-danger');

            if (!peer) {
                initHost();
            } else {
                // Broadcast screen to all connected viewers
                connectedPeers.forEach(peerId => {
                    peer.call(peerId, localStream, { metadata: { type: 'screen' } });
                });
            }

        } catch (err) {
            console.error('Screen sharing canceled or failed:', err);
            appendMessage('system', 'Screen sharing was canceled or denied.');
        }
    });

    function initHost() {
        isHost = true;
        const hostRoomId = 'mw-' + Math.random().toString(36).substring(2, 8);
        peer = new Peer(hostRoomId);

        updateStatus('Creating Room...', 'badge-offline');

        peer.on('open', (id) => {
            roomId = id;
            updateStatus('Live • Hosting', 'badge-live');

            const shareUrl = `${window.location.origin}${window.location.pathname}#${id}`;
            shareLinkInput.value = shareUrl;
            shareBox.classList.remove('hidden');

            appendMessage('system', `Room created! Send the link above to your friend.`);
        });

        // Incoming connection for chat & peer tracking
        peer.on('connection', (conn) => {
            setupChatConnection(conn);

            conn.on('open', () => {
                connectedPeers.add(conn.peer);
                appendMessage('system', 'A friend joined your room!');
                updateStatus('Live • Friend Connected', 'badge-connected');

                // Send screen share stream to friend
                if (localStream) {
                    peer.call(conn.peer, localStream, { metadata: { type: 'screen' } });
                }

                // If host's mic is already active, call friend with voice stream
                if (localMicStream) {
                    peer.call(conn.peer, localMicStream, { metadata: { type: 'voice' } });
                }
            });
        });

        // Handle incoming calls (e.g. friend calling with their mic stream)
        peer.on('call', handleIncomingCall);

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
        peer = new Peer();

        screenShareBtn.style.display = 'none'; // Viewer doesn't host screen
        placeholderText.textContent = 'Connecting to host...';
        updateStatus('Connecting...', 'badge-offline');

        peer.on('open', () => {
            appendMessage('system', `Connecting to host room: ${hostId}...`);

            const conn = peer.connect(hostId);
            setupChatConnection(conn);

            conn.on('open', () => {
                connectedPeers.add(hostId);
                updateStatus('Connected to Host', 'badge-connected');
                placeholderText.textContent = 'Waiting for host to share screen...';
                appendMessage('system', 'Connected! Waiting for host to stream.');
            });

            conn.on('close', () => {
                connectedPeers.delete(hostId);
                updateStatus('Host Disconnected', 'badge-offline');
                appendMessage('system', 'The host has left the room.');
            });
        });

        // Handle incoming calls (screen stream or host's voice)
        peer.on('call', handleIncomingCall);

        peer.on('error', (err) => {
            console.error('Viewer peer error:', err);
            updateStatus('Connection Error', 'badge-offline');
            appendMessage('system', `Could not connect to host. Make sure the room link is correct.`);
        });
    }

    // ──────────────────────────────────────────
    // 3. INCOMING CALL ROUTING (Screen vs Voice)
    // ──────────────────────────────────────────
    function handleIncomingCall(call) {
        const type = (call.metadata && call.metadata.type) || 'screen';

        if (type === 'voice') {
            // Answer with our mic stream if we have one, or empty
            call.answer(localMicStream || undefined);
            call.on('stream', (remoteVoiceStream) => {
                voiceAudio.srcObject = remoteVoiceStream;
                voiceAudio.play().catch(e => console.warn('Voice play blocked:', e));
                appendMessage('system', '🎙️ Friend joined voice chat!');
            });
        } else {
            // Answer screen stream
            call.answer();
            call.on('stream', (remoteStream) => {
                videoPlayer.srcObject = remoteStream;
                videoPlayer.muted = false;
                videoPlayer.play().catch(() => {
                    placeholderText.textContent = 'Click to unmute & play';
                    placeholder.classList.remove('hidden');
                });
                placeholder.classList.add('hidden');
                updateStatus('Watching Live', 'badge-live');
                appendMessage('system', 'Receiving movie screen stream!');
            });
        }
    }

    // ──────────────────────────────────────────
    // 4. TWO-WAY VOICE CHAT (MIC TOGGLE)
    // ──────────────────────────────────────────
    micBtn.addEventListener('click', async () => {
        // If microphone is not yet started, initialize it
        if (!localMicStream) {
            try {
                localMicStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true, // Prevents movie sound from looping
                        noiseSuppression: true,
                        autoGainControl: true
                    },
                    video: false
                });

                micTrack = localMicStream.getAudioTracks()[0];
                micTrack.enabled = true; // Start unmuted

                micBtn.textContent = '🎙️ Mic: On (Talking)';
                micBtn.classList.remove('btn-secondary');
                micBtn.classList.add('btn-success');
                appendMessage('system', 'You joined voice chat. Mic is ON.');

                // Call all connected peers with our mic stream
                connectedPeers.forEach(peerId => {
                    peer.call(peerId, localMicStream, { metadata: { type: 'voice' } });
                });

            } catch (err) {
                console.error('Mic access denied:', err);
                alert('Microphone permission was denied or not found.');
            }
            return;
        }

        // If mic already exists, toggle Mute / Unmute
        micTrack.enabled = !micTrack.enabled;

        if (micTrack.enabled) {
            micBtn.textContent = '🎙️ Mic: On (Talking)';
            micBtn.classList.remove('btn-secondary');
            micBtn.classList.add('btn-success');
            appendMessage('system', 'Microphone unmuted.');
        } else {
            micBtn.textContent = '🔇 Mic: Muted';
            micBtn.classList.remove('btn-success');
            micBtn.classList.add('btn-secondary');
            appendMessage('system', 'Microphone muted.');
        }
    });

    // ──────────────────────────────────────────
    // 5. REAL-TIME CHAT
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
            connectedPeers.delete(conn.peer);
        });
    }

    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const text = messageInput.value.trim();
        if (!text) return;

        appendMessage('me', text, 'You');
        messageInput.value = '';

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
    // 6. PLAYER CONTROLS (SPEAKER, PAUSE, FULLSCREEN)
    // ──────────────────────────────────────────
    speakerBtn.addEventListener('click', () => {
        videoPlayer.muted = !videoPlayer.muted;
        speakerBtn.textContent = videoPlayer.muted ? '🔇 Movie Muted' : '🔊 Movie Audio';
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
