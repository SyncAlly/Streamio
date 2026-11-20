document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const videoContainer = document.getElementById('video-container');
    const videoPlayer = document.getElementById('video-player');
    const voiceAudio = document.getElementById('voice-audio');
    const placeholder = document.getElementById('video-placeholder');
    const placeholderText = document.getElementById('placeholder-text');
    const unmuteOverlayBtn = document.getElementById('unmute-overlay-btn');
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

    // STUN + TURN for reliable NAT traversal across home/mobile networks.
    // TURN relay (openrelay.metered.ca) is a free public relay server used as fallback
    // when both sides are behind strict firewalls/NAT and direct peer-to-peer fails.
    const ICE_SERVERS = [
        // STUN: discovers public IP
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
        { urls: 'stun:openrelay.metered.ca:80' },
        // TURN UDP — relay traffic when direct P2P fails
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        // TURN TCP — works through most restrictive firewalls
        {
            urls: 'turn:openrelay.metered.ca:80?transport=tcp',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        // TURNS over TLS port 443 — bypasses corporate firewalls
        {
            urls: 'turns:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ];

    // PeerJS options — MUST be second argument; first arg is the peer ID (string or null)
    const PEER_OPTIONS = {
        config: { iceServers: ICE_SERVERS }
    };

    // State
    let peer = null;
    let localStream = null;      // Screen share stream
    let localMicStream = null;   // Microphone stream for voice chat
    let micTrack = null;
    let activeConnections = [];  // Data channels for chat
    let isHost = false;
    let roomId = null;
    let connectedPeers = new Set(); // Track remote peer IDs

    // Check if user is joining an existing room via query param (?room=...), hash (#...), or path
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    const urlHash = window.location.hash.replace('#', '').trim();
    const pathMatch = window.location.pathname.match(/mw-[a-z0-9]+/i);

    roomId = roomParam || urlHash || (pathMatch ? pathMatch[0] : null);
    if (roomId) {
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
        peer = new Peer(hostRoomId, PEER_OPTIONS);

        updateStatus('Creating Room...', 'badge-offline');

        peer.on('open', (id) => {
            roomId = id;
            updateStatus('Live • Hosting', 'badge-live');

            // Bulletproof share URL: works on Netlify and local files, works with all chat apps
            let shareUrl = '';
            if (window.location.protocol === 'file:') {
                shareUrl = `${window.location.href.split('?')[0].split('#')[0]}?room=${id}`;
            } else {
                let cleanPath = window.location.pathname.replace(/\/index\.html$/i, '');
                if (!cleanPath.endsWith('/')) cleanPath += '/';
                shareUrl = `${window.location.origin}${cleanPath}?room=${id}`;
            }
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
    let viewerRetryTimer = null;
    let viewerAttempt = 0;

    function initViewer(hostId) {
        isHost = false;
        viewerAttempt++;

        // Destroy existing peer cleanly before retrying
        if (peer) { try { peer.destroy(); } catch(e) {} peer = null; }

        // CRITICAL FIX: pass null as ID so PeerJS auto-generates one,
        // then pass PEER_OPTIONS as 2nd arg so TURN servers are actually applied.
        peer = new Peer(null, PEER_OPTIONS);

        screenShareBtn.style.display = 'none';
        placeholderText.textContent = viewerAttempt > 1
            ? `Reconnecting... (attempt ${viewerAttempt})`
            : 'Connecting to host...';
        updateStatus('Connecting...', 'badge-offline');

        // Auto-retry after 18 seconds if still not connected
        clearTimeout(viewerRetryTimer);
        viewerRetryTimer = setTimeout(() => {
            if (!connectedPeers.has(hostId)) {
                appendMessage('system', '⚠️ Connection timed out, retrying automatically...');
                initViewer(hostId);
            }
        }, 18000);

        peer.on('open', () => {
            appendMessage('system', `Connecting to host room: ${hostId}...`);

            const conn = peer.connect(hostId, { reliable: true });
            setupChatConnection(conn);

            conn.on('open', () => {
                clearTimeout(viewerRetryTimer);
                connectedPeers.add(hostId);
                updateStatus('Connected to Host', 'badge-connected');
                placeholderText.textContent = 'Waiting for host to share screen...';
                appendMessage('system', 'Connected! Waiting for host to stream.');
                // Request stream from host in case host was already sharing
                conn.send({ type: 'signal', action: 'request_stream' });
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
            appendMessage('system', `Connection error (${err.type}). Retrying in 5 seconds...`);
            clearTimeout(viewerRetryTimer);
            viewerRetryTimer = setTimeout(() => initViewer(hostId), 5000);
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
                // Start muted to bypass browser autoplay restrictions
                videoPlayer.muted = true;
                const playPromise = videoPlayer.play();
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        placeholder.classList.add('hidden');
                        updateStatus('Watching Live', 'badge-live');
                        appendMessage('system', 'Receiving movie screen stream!');
                        if (unmuteOverlayBtn) unmuteOverlayBtn.classList.remove('hidden');
                    }).catch(err => {
                        console.warn('Playback error:', err);
                        placeholderText.textContent = 'Click to Play Movie';
                        placeholder.classList.remove('hidden');
                    });
                }
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
    // 5. REAL-TIME CHAT & STREAM REQUEST SIGNALING
    // ──────────────────────────────────────────
    function setupChatConnection(conn) {
        activeConnections.push(conn);

        conn.on('data', (data) => {
            if (data && data.type === 'signal' && data.action === 'request_stream') {
                if (localStream && isHost) {
                    peer.call(conn.peer, localStream, { metadata: { type: 'screen' } });
                }
                return;
            }
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
    // 6. PLAYER CONTROLS (SPEAKER, PAUSE, FULLSCREEN, UNMUTE)
    // ──────────────────────────────────────────
    function unmuteAndPlayMovie() {
        if (videoPlayer.srcObject) {
            videoPlayer.muted = false;
            videoPlayer.play().then(() => {
                if (unmuteOverlayBtn) unmuteOverlayBtn.classList.add('hidden');
                placeholder.classList.add('hidden');
                speakerBtn.textContent = '🔊 Movie Audio';
            }).catch(e => console.warn('Unmute error:', e));
        }
        if (voiceAudio.srcObject && voiceAudio.paused) {
            voiceAudio.play().catch(e => console.warn('Voice play error:', e));
        }
    }

    if (unmuteOverlayBtn) {
        unmuteOverlayBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            unmuteAndPlayMovie();
        });
    }

    if (placeholder) {
        placeholder.addEventListener('click', () => {
            unmuteAndPlayMovie();
        });
    }

    if (videoContainer) {
        videoContainer.addEventListener('click', () => {
            if (videoPlayer.srcObject && videoPlayer.muted) {
                unmuteAndPlayMovie();
            }
        });
    }

    speakerBtn.addEventListener('click', () => {
        if (!videoPlayer.srcObject) return;
        if (videoPlayer.paused) {
            videoPlayer.play();
        }
        videoPlayer.muted = !videoPlayer.muted;
        speakerBtn.textContent = videoPlayer.muted ? '🔇 Movie Muted' : '🔊 Movie Audio';
        if (!videoPlayer.muted && unmuteOverlayBtn) {
            unmuteOverlayBtn.classList.add('hidden');
        }
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
