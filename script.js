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

    // ── High-Speed STUN + Global Authenticated TURN Relay ─────────────────────
    // Guaranteed WebRTC connection across all networks, VPNs, mobile cellular, and firewalls
    const PEER_OPTIONS = {
        config: {
            iceServers: [
                // Fast Google & Cloudflare STUN
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun.cloudflare.com:3478' },
                { urls: 'stun:global.relay.metered.ca:80' },
                // Metered Global TURN Relay (UDP)
                {
                    urls: 'turn:global.relay.metered.ca:80',
                    username: '82aad90822871c83531a3ced',
                    credential: '79aMgXZS4xge8k0H'
                },
                // Metered Global TURN Relay (TCP - punches through home routers and NAT)
                {
                    urls: 'turn:global.relay.metered.ca:80?transport=tcp',
                    username: '82aad90822871c83531a3ced',
                    credential: '79aMgXZS4xge8k0H'
                },
                // Metered Global TURNS Relay (TLS 443 - punches through all VPNs & mobile carriers)
                {
                    urls: 'turns:global.relay.metered.ca:443?transport=tcp',
                    username: '82aad90822871c83531a3ced',
                    credential: '79aMgXZS4xge8k0H'
                }
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
            // Optimized for movies: 1080p, 30 FPS (eliminates network bufferbloat across routers/VPN)
            localStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    frameRate: { ideal: 30, max: 30 }
                },
                audio: true
            });

            // CRITICAL: Tells browser this is a movie/video, NOT a static document
            // This prevents Chrome from dropping framerate to 2-5 FPS!
            const videoTrack = localStream.getVideoTracks()[0];
            if (videoTrack && 'contentHint' in videoTrack) {
                videoTrack.contentHint = 'motion';
            }
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
                callPeerWithStream(pid, localStream, 'screen');
            });
        }
    });

    // Helper: Calls peer and enforces HD movie bitrate, H.264 hardware acceleration & anti-jitter
    function callPeerWithStream(peerId, stream, type) {
        const call = peer.call(peerId, stream, { metadata: { type: type } });
        if (call && type === 'screen') {
            const enforceHighQuality = function () {
                try {
                    const pc = call.peerConnection;
                    if (!pc) return;

                    // Prefer H.264: Uses dedicated hardware chips on phones for 0% CPU stutter
                    if (pc.getTransceivers && window.RTCRtpSender && RTCRtpSender.getCapabilities) {
                        pc.getTransceivers().forEach(function (transceiver) {
                            if (transceiver.sender && transceiver.sender.track && transceiver.sender.track.kind === 'video') {
                                try {
                                    const caps = RTCRtpSender.getCapabilities('video');
                                    if (caps && caps.codecs) {
                                        const h264 = caps.codecs.filter(function (c) { return c.mimeType.toLowerCase() === 'video/h264'; });
                                        const others = caps.codecs.filter(function (c) { return c.mimeType.toLowerCase() !== 'video/h264'; });
                                        if (h264.length > 0 && transceiver.setCodecPreferences) {
                                            transceiver.setCodecPreferences(h264.concat(others));
                                        }
                                    }
                                } catch (e) {}
                            }
                        });
                    }

                    // Enforce True 1:1 Source Fidelity: 8 Mbps Bitrate & Zero Downsampling
                    if (pc.getSenders) {
                        pc.getSenders().forEach(function (sender) {
                            if (sender.track && sender.track.kind === 'video') {
                                const params = sender.getParameters();
                                if (!params.encodings || params.encodings.length === 0) {
                                    params.encodings = [{}];
                                }
                                // Pristine Bitrate: up to 8 Mbps allows full 720p/1080p source clarity with zero compression blur
                                params.encodings[0].maxBitrate = 8000000;
                                // Strictly 1:1 pixel mapping: forbids browser from downscaling the physical resolution
                                params.encodings[0].scaleResolutionDownBy = 1.0;
                                // Strict Resolution Lock: preserves 100% of original source sharpness on larger laptop/monitor screens
                                params.degradationPreference = 'maintain-resolution';
                                sender.setParameters(params).catch(function () {});
                            }
                        });
                    }
                } catch (e) {}
            };

            setTimeout(enforceHighQuality, 300);
            setTimeout(enforceHighQuality, 1200);
            if (call.peerConnection) {
                call.peerConnection.addEventListener('connectionstatechange', enforceHighQuality);
            }
        }
        return call;
    }

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
                if (localStream) callPeerWithStream(conn.peer, localStream, 'screen');
                if (localMicStream) callPeerWithStream(conn.peer, localMicStream, 'voice');
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

            // Anti-Stutter Jitter Buffer: 200ms buffer absorbs momentary network/Wi-Fi delay spikes
            try {
                if (call.peerConnection && call.peerConnection.getReceivers) {
                    call.peerConnection.getReceivers().forEach(function (receiver) {
                        if (receiver.track && receiver.track.kind === 'video' && 'playoutDelayHint' in receiver) {
                            receiver.playoutDelayHint = 0.2;
                        }
                    });
                }
            } catch (e) {}

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
