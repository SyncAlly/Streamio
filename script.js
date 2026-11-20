// Wait for EVERYTHING (including PeerJS CDN script) to fully load before running
window.addEventListener('load', function () {

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const videoPlayer    = document.getElementById('video-player');
    const voiceAudio     = document.getElementById('voice-audio');
    const placeholder    = document.getElementById('video-placeholder');
    const placeholderText= document.getElementById('placeholder-text');
    const statusBadge    = document.getElementById('status-badge');
    const screenShareBtn = document.getElementById('screen-share-btn');
    const micBtn         = document.getElementById('mic-btn');
    const speakerBtn     = document.getElementById('speaker-btn');
    const pauseBtn       = document.getElementById('pause-btn');
    const fullscreenBtn  = document.getElementById('fullscreen-btn');
    const shareBox       = document.getElementById('share-box');
    const shareLinkInput = document.getElementById('share-link-input');
    const copyLinkBtn    = document.getElementById('copy-link-btn');
    const chatForm       = document.getElementById('chat-form');
    const messageInput   = document.getElementById('message-input');
    const messagesList   = document.getElementById('messages');

    // ── STUN + TURN config ────────────────────────────────────────────────────
    // TURN relay is used when direct P2P fails across different routers/networks
    const PEER_OPTIONS = {
        config: {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' },
                // TURN UDP relay
                { urls: 'turn:openrelay.metered.ca:80',
                  username: 'openrelayproject', credential: 'openrelayproject' },
                // TURN TCP (works through most home firewalls)
                { urls: 'turn:openrelay.metered.ca:80?transport=tcp',
                  username: 'openrelayproject', credential: 'openrelayproject' },
                // TURNS over port 443 (bypasses strict firewalls)
                { urls: 'turns:openrelay.metered.ca:443',
                  username: 'openrelayproject', credential: 'openrelayproject' }
            ]
        }
    };

    // ── State ─────────────────────────────────────────────────────────────────
    let peer             = null;
    let localStream      = null;   // screen-share stream (host)
    let localMicStream   = null;   // mic stream (both sides)
    let micTrack         = null;
    let activeConns      = [];     // data channels for chat
    let connectedPeers   = new Set();
    let isHost           = false;
    let roomId           = null;

    // ── Detect room ID from URL (?room=... OR #mw-... OR path) ────────────────
    const params   = new URLSearchParams(window.location.search);
    const fromQuery = params.get('room') || '';
    const fromHash  = window.location.hash.replace('#', '').trim();
    const fromPath  = (window.location.pathname.match(/mw-[a-z0-9]+/i) || [])[0] || '';
    roomId = fromQuery || fromHash || fromPath || null;

    // ── Boot ──────────────────────────────────────────────────────────────────
    if (roomId) {
        startViewer(roomId);
    } else {
        updateStatus('Ready to Host', 'badge-offline');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 1. HOST — Screen Share
    // ══════════════════════════════════════════════════════════════════════════
    screenShareBtn.addEventListener('click', async function () {
        if (localStream) { stopShare(); return; }

        try {
            localStream = await navigator.mediaDevices.getDisplayMedia({
                video: { cursor: 'always', frameRate: { ideal: 60, max: 60 } },
                audio: true
            });
        } catch (e) {
            appendMsg('system', 'Screen sharing was cancelled or denied.');
            return;
        }

        videoPlayer.srcObject = localStream;
        videoPlayer.muted = true;
        videoPlayer.play().catch(() => {});
        placeholder.classList.add('hidden');
        screenShareBtn.textContent = 'Stop Sharing';
        screenShareBtn.className = 'btn btn-danger';

        localStream.getVideoTracks()[0].addEventListener('ended', stopShare);

        if (!peer) {
            startHost();
        } else {
            connectedPeers.forEach(function (pid) {
                peer.call(pid, localStream, { metadata: { type: 'screen' } });
            });
        }
    });

    function startHost() {
        isHost = true;
        const hostId = 'mw-' + Math.random().toString(36).substring(2, 8);
        peer = new Peer(hostId, PEER_OPTIONS);

        updateStatus('Creating Room…', 'badge-offline');

        peer.on('open', function (id) {
            roomId = id;
            updateStatus('Live • Hosting', 'badge-live');

            // Build share URL — keep same origin, strip index.html from path
            var base = window.location.origin;
            var path = window.location.pathname.replace(/\/index\.html$/i, '');
            if (!path.endsWith('/')) path += '/';
            var shareUrl = base + path + '?room=' + id;

            shareLinkInput.value = shareUrl;
            shareBox.classList.remove('hidden');
            appendMsg('system', 'Room ready! Share the link above with your friend.');
        });

        peer.on('connection', function (conn) {
            setupChat(conn);
            conn.on('open', function () {
                connectedPeers.add(conn.peer);
                appendMsg('system', 'Your friend joined!');
                updateStatus('Live • Friend Connected', 'badge-connected');
                if (localStream) peer.call(conn.peer, localStream, { metadata: { type: 'screen' } });
                if (localMicStream) peer.call(conn.peer, localMicStream, { metadata: { type: 'voice' } });
            });
        });

        peer.on('call', handleCall);
        peer.on('error', function (err) {
            appendMsg('system', 'Host error: ' + err.type);
        });
    }

    function stopShare() {
        if (localStream) { localStream.getTracks().forEach(function (t) { t.stop(); }); localStream = null; }
        videoPlayer.srcObject = null;
        placeholder.classList.remove('hidden');
        placeholderText.textContent = 'Screen share stopped';
        screenShareBtn.textContent = 'Start Screen Share';
        screenShareBtn.className = 'btn btn-primary';
        shareBox.classList.add('hidden');
        updateStatus('Ready to Host', 'badge-offline');
        appendMsg('system', 'You stopped sharing.');
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 2. VIEWER
    // ══════════════════════════════════════════════════════════════════════════
    function startViewer(hostId) {
        isHost = false;
        screenShareBtn.style.display = 'none';
        placeholderText.textContent = 'Connecting to host…';
        updateStatus('Connecting…', 'badge-offline');

        // Destroy any old peer cleanly
        if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }

        peer = new Peer(undefined, PEER_OPTIONS);

        peer.on('open', function () {
            appendMsg('system', 'Connecting to room ' + hostId + '…');
            var conn = peer.connect(hostId, { reliable: true });
            setupChat(conn);

            conn.on('open', function () {
                connectedPeers.add(hostId);
                updateStatus('Connected to Host', 'badge-connected');
                placeholderText.textContent = 'Waiting for host to share screen…';
                appendMsg('system', 'Connected! Waiting for the host to share their screen.');
            });

            conn.on('close', function () {
                connectedPeers.delete(hostId);
                updateStatus('Host Disconnected', 'badge-offline');
                appendMsg('system', 'Host disconnected.');
            });
        });

        peer.on('call', handleCall);

        peer.on('error', function (err) {
            updateStatus('Error — Retrying…', 'badge-offline');
            appendMsg('system', 'Connection problem (' + err.type + '), retrying in 6 s…');
            setTimeout(function () { startViewer(hostId); }, 6000);
        });

        // Auto-retry after 20 s if still not connected
        setTimeout(function () {
            if (!connectedPeers.has(hostId)) {
                appendMsg('system', 'Still connecting — retrying automatically…');
                startViewer(hostId);
            }
        }, 20000);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // 3. Incoming call handler (screen stream OR voice stream)
    // ══════════════════════════════════════════════════════════════════════════
    function handleCall(call) {
        var type = (call.metadata && call.metadata.type) || 'screen';

        if (type === 'voice') {
            call.answer(localMicStream || undefined);
            call.on('stream', function (stream) {
                voiceAudio.srcObject = stream;
                voiceAudio.play().catch(function () {});
                appendMsg('system', '🎙️ Voice chat connected.');
            });
        } else {
            call.answer();
            call.on('stream', function (stream) {
                videoPlayer.srcObject = stream;
                // Start muted to pass browser autoplay policy, then prompt user
                videoPlayer.muted = true;
                videoPlayer.play().then(function () {
                    placeholder.classList.add('hidden');
                    updateStatus('Watching Live', 'badge-live');
                    appendMsg('system', '🎬 Receiving stream! Click the video to unmute.');
                }).catch(function () {
                    placeholderText.textContent = 'Click here to play';
                });
            });
        }
    }

    // Click anywhere on the video to unmute it
    videoPlayer.addEventListener('click', function () {
        if (videoPlayer.srcObject && videoPlayer.muted) {
            videoPlayer.muted = false;
            videoPlayer.play().catch(function () {});
        }
    });
    placeholder.addEventListener('click', function () {
        if (videoPlayer.srcObject) {
            videoPlayer.muted = false;
            placeholder.classList.add('hidden');
            videoPlayer.play().catch(function () {});
        }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 4. Microphone (2-way voice chat)
    // ══════════════════════════════════════════════════════════════════════════
    micBtn.addEventListener('click', async function () {
        if (!localMicStream) {
            try {
                localMicStream = await navigator.mediaDevices.getUserMedia({
                    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                    video: false
                });
                micTrack = localMicStream.getAudioTracks()[0];
                micTrack.enabled = true;
                micBtn.textContent = '🎙️ Mic: On (Talking)';
                micBtn.className = 'btn btn-success';
                appendMsg('system', 'Mic ON — you are live.');
                connectedPeers.forEach(function (pid) {
                    peer.call(pid, localMicStream, { metadata: { type: 'voice' } });
                });
            } catch (e) {
                alert('Microphone permission denied.');
            }
            return;
        }
        micTrack.enabled = !micTrack.enabled;
        if (micTrack.enabled) {
            micBtn.textContent = '🎙️ Mic: On (Talking)';
            micBtn.className = 'btn btn-success';
            appendMsg('system', 'Mic unmuted.');
        } else {
            micBtn.textContent = '🔇 Mic: Muted';
            micBtn.className = 'btn btn-secondary';
            appendMsg('system', 'Mic muted.');
        }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 5. Chat
    // ══════════════════════════════════════════════════════════════════════════
    function setupChat(conn) {
        activeConns.push(conn);
        conn.on('data', function (data) {
            if (data && data.text) appendMsg('friend', data.text, data.sender || 'Friend');
        });
        conn.on('close', function () {
            activeConns = activeConns.filter(function (c) { return c !== conn; });
            connectedPeers.delete(conn.peer);
        });
    }

    chatForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var text = messageInput.value.trim();
        if (!text) return;
        appendMsg('me', text, 'You');
        messageInput.value = '';
        activeConns.forEach(function (c) {
            if (c.open) c.send({ text: text, sender: isHost ? 'Host' : 'Friend' });
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 6. Player controls
    // ══════════════════════════════════════════════════════════════════════════
    speakerBtn.addEventListener('click', function () {
        videoPlayer.muted = !videoPlayer.muted;
        speakerBtn.textContent = videoPlayer.muted ? '🔇 Movie Muted' : '🔊 Movie Audio';
    });

    pauseBtn.addEventListener('click', function () {
        if (videoPlayer.paused) { videoPlayer.play(); pauseBtn.textContent = 'Pause'; }
        else { videoPlayer.pause(); pauseBtn.textContent = 'Resume'; }
    });

    fullscreenBtn.addEventListener('click', function () {
        var c = document.getElementById('video-container');
        if (!document.fullscreenElement) c.requestFullscreen().catch(function () {});
        else document.exitFullscreen();
    });

    copyLinkBtn.addEventListener('click', function () {
        shareLinkInput.select();
        navigator.clipboard.writeText(shareLinkInput.value).then(function () {
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(function () { copyLinkBtn.textContent = 'Copy Link'; }, 2000);
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════════════════════════════════════
    function updateStatus(text, cls) {
        statusBadge.textContent = text;
        statusBadge.className = 'badge ' + cls;
    }

    function appendMsg(type, text, author) {
        var li = document.createElement('li');
        if (type === 'me') {
            li.className = 'msg-me';
            li.innerHTML = '<span class="msg-author">' + esc(author) + '</span>' + esc(text);
        } else if (type === 'friend') {
            li.className = 'msg-friend';
            li.innerHTML = '<span class="msg-author">' + esc(author) + '</span>' + esc(text);
        } else {
            li.className = 'system-msg';
            li.textContent = text;
        }
        messagesList.appendChild(li);
        messagesList.scrollTop = messagesList.scrollHeight;
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }

}); // end window.load
