// Wait for EVERYTHING (including PeerJS CDN script) to fully load before running
window.addEventListener('load', function () {

    // ── DOM refs ──────────────────────────────────────────────────────────────
    const videoContainer = document.getElementById('video-container');
    const videoPlayer    = document.getElementById('video-player');
    const voiceAudio     = document.getElementById('voice-audio');
    const placeholder    = document.getElementById('video-placeholder');
    const placeholderText= document.getElementById('placeholder-text');
    const unmuteOverlayBtn = document.getElementById('unmute-overlay-btn');
    const overlayControls = document.getElementById('video-overlay-controls');
    const overlayMuteBtn = document.getElementById('overlay-mute-btn');
    const overlayPauseBtn= document.getElementById('overlay-pause-btn');
    const overlayFsBtn   = document.getElementById('overlay-fullscreen-btn');
    const routeIndicator = document.getElementById('route-indicator');
    const wifiIndicator  = document.getElementById('wifi-indicator');
    const statusBadge    = document.getElementById('status-badge');
    const routeBadge     = document.getElementById('route-badge');
    const screenShareBtn = document.getElementById('screen-share-btn');

    // ── SVG Icons for Aligned Indicators & Overlay Controls ──────────────────
    const SVG_HOUSE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
    const SVG_GLOBE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';
    const SVG_WIFI_ON = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.86a10 10 0 0 1 14 0"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/></svg>';
    const SVG_WIFI_OFF = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="2" x2="22" y2="22"/><path d="M8.5 16.5a5 5 0 0 1 7 0"/><path d="M2 8.82a15 15 0 0 1 4.17-2.65"/><path d="M10.66 5c4.01-.36 8.14.9 11.34 3.82"/><path d="M16.85 11.25a10 10 0 0 1 2.22 1.61"/><path d="M5 13a10 10 0 0 1 5.24-2.76"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg>';

    const SVG_SPEAKER_ON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    const SVG_SPEAKER_MUTED = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';
    const SVG_PAUSE = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>';
    const SVG_PLAY = '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
    const SVG_FS_ENTER = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>';
    const SVG_FS_EXIT = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>';
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
    let viewerCounter    = 0;
    let mySenderName     = 'Friend';

    // ── Tailscale Enforcer: Force Tailscale (100.x) and Block Local Wi-Fi (192.168.x) ──
    const TAILSCALE_HOST_IP = '100.109.86.125';

    (function patchRTCForTailscale() {
        if (typeof RTCPeerConnection === 'undefined') return;

        // 1. Intercept addIceCandidate: Drop any 192.168.x LAN candidate & rewrite .local
        var _origAdd = RTCPeerConnection.prototype.addIceCandidate;
        RTCPeerConnection.prototype.addIceCandidate = function (candidate) {
            if (candidate && candidate.candidate) {
                var c = candidate.candidate;
                // DROP local Wi-Fi candidates so WebRTC is forced to pick Tailscale!
                if (c.indexOf(' 192.168.') !== -1 || c.indexOf(' 10.') !== -1 || c.indexOf(' 172.16.') !== -1) {
                    return Promise.resolve();
                }
                // Rewrite any mDNS .local to Tailscale IP
                if (c.indexOf('.local') !== -1) {
                    c = c.replace(/[a-f0-9-]+\.local/gi, TAILSCALE_HOST_IP);
                    try {
                        candidate = new RTCIceCandidate({
                            candidate: c,
                            sdpMid: candidate.sdpMid,
                            sdpMLineIndex: candidate.sdpMLineIndex
                        });
                    } catch (e) {
                        candidate.candidate = c;
                    }
                }
            }
            return _origAdd.apply(this, [candidate]);
        };

        // 2. Intercept setRemoteDescription: Remove 192.168.x candidate lines from SDP
        var _origSetRemote = RTCPeerConnection.prototype.setRemoteDescription;
        RTCPeerConnection.prototype.setRemoteDescription = function (desc) {
            if (desc && typeof desc.sdp === 'string') {
                var lines = desc.sdp.split('\r\n');
                var clean = lines.filter(function (l) {
                    return !(l.startsWith('a=candidate:') && (l.indexOf(' 192.168.') !== -1 || l.indexOf(' 10.') !== -1 || l.indexOf(' 172.16.') !== -1));
                }).map(function (l) {
                    if (l.startsWith('a=candidate:') && l.indexOf('.local') !== -1) {
                        return l.replace(/[a-f0-9-]+\.local/gi, TAILSCALE_HOST_IP);
                    }
                    return l;
                });
                desc = { type: desc.type, sdp: clean.join('\r\n') };
            }
            return _origSetRemote.apply(this, [desc]);
        };

        // 3. Intercept onicecandidate setter: Host sends 100.109.86.125 instead of 192.168.x / .local
        var descProp = Object.getOwnPropertyDescriptor(RTCPeerConnection.prototype, 'onicecandidate');
        if (descProp && descProp.set) {
            var _origSetOnIce = descProp.set;
            Object.defineProperty(RTCPeerConnection.prototype, 'onicecandidate', {
                set: function (fn) {
                    if (typeof fn !== 'function') return _origSetOnIce.call(this, fn);
                    var wrapped = function (evt) {
                        if (evt && evt.candidate && evt.candidate.candidate) {
                            var str = evt.candidate.candidate;
                            // On the host: turn any host candidate into a Tailscale 100.109.86.125 candidate
                            if (isHost && (str.indexOf('typ host') !== -1 || str.indexOf('.local') !== -1)) {
                                str = str.replace(/[a-f0-9-]+\.local/gi, TAILSCALE_HOST_IP);
                                str = str.replace(/ 192\.168\.\d+\.\d+ /g, ' ' + TAILSCALE_HOST_IP + ' ');
                                try {
                                    evt = {
                                        candidate: new RTCIceCandidate({
                                            candidate: str,
                                            sdpMid: evt.candidate.sdpMid,
                                            sdpMLineIndex: evt.candidate.sdpMLineIndex
                                        })
                                    };
                                } catch (e) {}
                            }
                            // Drop remaining 192.168.x candidate so it is never transmitted
                            if (str.indexOf(' 192.168.') !== -1) {
                                return;
                            }
                        }
                        return fn.apply(this, arguments);
                    };
                    return _origSetOnIce.call(this, wrapped);
                },
                get: descProp.get,
                configurable: true
            });
        }
    })();

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
            // Max 1080p, Full 60 FPS (Silky smooth motion on high-refresh phone & laptop screens)
            localStream = await navigator.mediaDevices.getDisplayMedia({
                video: {
                    cursor: 'always',
                    width: { ideal: 1920, max: 1920 },
                    height: { ideal: 1080, max: 1080 },
                    frameRate: { ideal: 60, max: 60 }
                },
                audio: true
            });

            // CRITICAL: Tells browser this is a movie/video, NOT a static document
            // This prevents Chrome from dropping framerate!
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

    // Helper: Calls peer and enforces Max 1080p graphics, H.264 hardware acceleration, and route monitoring
    function callPeerWithStream(peerId, stream, type) {
        const call = peer.call(peerId, stream, { metadata: { type: type } });
        if (call && type === 'screen') {
            monitorRoute(call);
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

                    // Optimized 1080p Graphics: 4.5 Mbps Bitrate per peer, 60 FPS
                    // 4.5 Mbps H.264 provides crisp 1080p clarity while keeping total host upload
                    // under 10 Mbps for 2-3 simultaneous viewers, preventing Wi-Fi upload saturation/bufferbloat.
                    if (pc.getSenders) {
                        pc.getSenders().forEach(function (sender) {
                            if (sender.track && sender.track.kind === 'video') {
                                const params = sender.getParameters();
                                if (!params.encodings || params.encodings.length === 0) {
                                    params.encodings = [{}];
                                }
                                params.encodings[0].maxBitrate = 4500000;
                                params.encodings[0].scaleResolutionDownBy = 1.0;
                                params.degradationPreference = 'balanced';
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
        mySenderName = 'Host';
        viewerCounter = 0;
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
            shareBox.style.display = 'flex';
            if (routeBadge) {
                routeBadge.textContent = '⚡ Route: Waiting for friend…';
                routeBadge.className = 'badge badge-route';
                routeBadge.classList.remove('hidden');
                routeBadge.style.display = 'inline-block';
            }
        });

        peer.on('connection', function (conn) {
            setupChat(conn);
            monitorRoute(conn);
            conn.on('open', function () {
                connectedPeers.add(conn.peer);
                viewerCounter++;
                conn.send({ type: 'assign-name', name: 'Friend ' + viewerCounter });
                updateStatus('Live • Friend Connected', 'badge-connected');
                if (localStream) callPeerWithStream(conn.peer, localStream, 'screen');
                if (localMicStream) callPeerWithStream(conn.peer, localMicStream, 'voice');
            });
        });

        peer.on('call', handleCall);
        peer.on('error', function (err) {
            appendMsg('system', 'Host notice: ' + (err.message || err.type));
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
        shareBox.style.display = 'none';
        if (routeBadge) {
            routeBadge.classList.add('hidden');
            routeBadge.style.display = 'none';
        }
        if (routeIndicator) {
            routeIndicator.classList.add('hidden');
            routeIndicator.style.display = 'none';
        }
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
        if (routeBadge) {
            routeBadge.textContent = '⚡ Route: Connecting…';
            routeBadge.className = 'badge badge-route';
            routeBadge.classList.remove('hidden');
            routeBadge.style.display = 'inline-block';
        }

        // Destroy any old peer cleanly
        if (peer) { try { peer.destroy(); } catch (e) {} peer = null; }

        peer = new Peer(undefined, PEER_OPTIONS);

        peer.on('open', function () {
            var conn = peer.connect(hostId, { reliable: true });
            setupChat(conn);
            monitorRoute(conn);

            conn.on('open', function () {
                connectedPeers.add(hostId);
                updateStatus('Connected to Host', 'badge-connected');
                placeholderText.textContent = 'Waiting for host to share screen…';
            });

            conn.on('close', function () {
                connectedPeers.delete(hostId);
                updateStatus('Host Disconnected', 'badge-offline');
            });
        });

        peer.on('call', handleCall);

        peer.on('error', function (err) {
            updateStatus('Error — Retrying…', 'badge-offline');
            setTimeout(function () { startViewer(hostId); }, 6000);
        });

        // Auto-retry after 20 s if still not connected
        setTimeout(function () {
            if (!connectedPeers.has(hostId)) {
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
            });
        } else {
            call.answer();
            monitorRoute(call);

            // Responsive Jitter Buffer: 50ms buffer for ultra-fluid 60 FPS motion without sluggish lag
            try {
                if (call.peerConnection && call.peerConnection.getReceivers) {
                    call.peerConnection.getReceivers().forEach(function (receiver) {
                        if (receiver.track && receiver.track.kind === 'video' && 'playoutDelayHint' in receiver) {
                            receiver.playoutDelayHint = 0.05;
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
                micBtn.textContent = 'Mic: On (Talking)';
                micBtn.className = 'btn btn-success';
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
            micBtn.textContent = 'Mic: On (Talking)';
            micBtn.className = 'btn btn-success';
        } else {
            micBtn.textContent = 'Mic: Muted';
            micBtn.className = 'btn btn-secondary';
        }
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 5. Chat & Multi-User Message Relay
    // ══════════════════════════════════════════════════════════════════════════
    function setupChat(conn) {
        activeConns.push(conn);
        conn.on('data', function (data) {
            if (!data) return;

            // Handle name assignment from host
            if (data.type === 'assign-name' && data.name) {
                mySenderName = data.name;
                return;
            }

            // Normal chat message
            if (data.text) {
                appendMsg('friend', data.text, data.sender || 'Friend');

                // Host acts as the relay hub: broadcast to all other connected peers
                if (isHost) {
                    activeConns.forEach(function (c) {
                        if (c !== conn && c.open) {
                            c.send(data);
                        }
                    });
                }
            }
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
        var payload = { text: text, sender: mySenderName || (isHost ? 'Host' : 'Friend') };
        activeConns.forEach(function (c) {
            if (c.open) c.send(payload);
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // 6. Player controls & Fullscreen In-Video Overlay
    // ══════════════════════════════════════════════════════════════════════════
    function syncAudioUI() {
        const isMuted = videoPlayer.muted;
        if (speakerBtn) speakerBtn.textContent = isMuted ? 'Movie Muted' : 'Movie Audio';
        if (overlayMuteBtn) {
            overlayMuteBtn.innerHTML = isMuted ? SVG_SPEAKER_MUTED : SVG_SPEAKER_ON;
            overlayMuteBtn.title = isMuted ? 'Unmute Movie Audio' : 'Mute Movie Audio';
        }
        if (unmuteOverlayBtn) {
            if (isMuted && videoPlayer.srcObject) {
                unmuteOverlayBtn.classList.remove('hidden');
            } else {
                unmuteOverlayBtn.classList.add('hidden');
            }
        }
    }

    function syncPlaybackUI() {
        const isPaused = videoPlayer.paused;
        if (pauseBtn) pauseBtn.textContent = isPaused ? 'Resume' : 'Pause';
        if (overlayPauseBtn) {
            overlayPauseBtn.innerHTML = isPaused ? SVG_PLAY : SVG_PAUSE;
            overlayPauseBtn.title = isPaused ? 'Play / Resume Movie' : 'Pause Movie';
        }
    }

    function syncFullscreenUI() {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        if (fullscreenBtn) fullscreenBtn.textContent = isFs ? 'Exit Fullscreen' : 'Fullscreen';
        if (overlayFsBtn) {
            overlayFsBtn.innerHTML = isFs ? SVG_FS_EXIT : SVG_FS_ENTER;
            overlayFsBtn.title = isFs ? 'Exit Fullscreen' : 'Fullscreen';
        }
    }

    function toggleFullscreen() {
        const c = videoContainer || document.getElementById('video-container');
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (c.requestFullscreen) c.requestFullscreen().catch(function () {});
            else if (c.webkitRequestFullscreen) c.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
    }

    // Toggle overlay controls on click: pops up on first click, disappears on next click
    let overlayHideTimer = null;
    function toggleOverlayControls(e) {
        if (!overlayControls) return;
        // Don't toggle if user clicked directly on one of the action buttons or unmute overlay
        if (e && e.target && (e.target.closest('#video-overlay-controls') || e.target.closest('#unmute-overlay-btn'))) {
            return;
        }

        const isCurrentlyVisible = overlayControls.classList.contains('visible');
        clearTimeout(overlayHideTimer);

        if (isCurrentlyVisible) {
            // Already visible -> hide immediately on click!
            overlayControls.classList.remove('visible');
        } else {
            // Hidden -> pop up buttons!
            overlayControls.classList.add('visible');
            // Auto-hide after 4 seconds of inactivity as a fallback
            overlayHideTimer = setTimeout(function () {
                overlayControls.classList.remove('visible');
            }, 4000);
        }
    }

    // Initialize UI states
    syncAudioUI();
    syncPlaybackUI();
    syncFullscreenUI();

    videoPlayer.addEventListener('volumechange', syncAudioUI);
    videoPlayer.addEventListener('play', syncPlaybackUI);
    videoPlayer.addEventListener('pause', syncPlaybackUI);
    document.addEventListener('fullscreenchange', syncFullscreenUI);
    document.addEventListener('webkitfullscreenchange', syncFullscreenUI);

    if (speakerBtn) {
        speakerBtn.addEventListener('click', function () {
            videoPlayer.muted = !videoPlayer.muted;
            syncAudioUI();
        });
    }

    if (pauseBtn) {
        pauseBtn.addEventListener('click', function () {
            if (videoPlayer.paused) videoPlayer.play();
            else videoPlayer.pause();
            syncPlaybackUI();
        });
    }

    if (fullscreenBtn) {
        fullscreenBtn.addEventListener('click', toggleFullscreen);
    }

    if (overlayMuteBtn) {
        overlayMuteBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            videoPlayer.muted = !videoPlayer.muted;
            syncAudioUI();
            clearTimeout(overlayHideTimer);
            overlayHideTimer = setTimeout(function () {
                overlayControls.classList.remove('visible');
            }, 4000);
        });
    }

    if (overlayPauseBtn) {
        overlayPauseBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            if (videoPlayer.paused) videoPlayer.play();
            else videoPlayer.pause();
            syncPlaybackUI();
            clearTimeout(overlayHideTimer);
            overlayHideTimer = setTimeout(function () {
                overlayControls.classList.remove('visible');
            }, 4000);
        });
    }

    if (overlayFsBtn) {
        overlayFsBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            toggleFullscreen();
            clearTimeout(overlayHideTimer);
            overlayHideTimer = setTimeout(function () {
                overlayControls.classList.remove('visible');
            }, 4000);
        });
    }

    if (unmuteOverlayBtn) {
        unmuteOverlayBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            videoPlayer.muted = false;
            videoPlayer.play().catch(function () {});
            syncAudioUI();
        });
    }

    if (videoContainer) {
        videoContainer.addEventListener('click', toggleOverlayControls);
    }

    if (overlayControls) {
        overlayControls.addEventListener('mouseenter', function () {
            clearTimeout(overlayHideTimer);
            overlayControls.classList.add('visible');
        });
        overlayControls.addEventListener('mouseleave', function () {
            clearTimeout(overlayHideTimer);
            overlayHideTimer = setTimeout(function () {
                overlayControls.classList.remove('visible');
            }, 2000);
        });
    }

    copyLinkBtn.addEventListener('click', function () {
        if (!shareLinkInput.value) return;
        shareLinkInput.select();
        navigator.clipboard.writeText(shareLinkInput.value).then(function () {
            copyLinkBtn.textContent = 'Copied!';
            setTimeout(function () { copyLinkBtn.textContent = 'Copy Link'; }, 2000);
        }).catch(function () {
            try {
                document.execCommand('copy');
                copyLinkBtn.textContent = 'Copied!';
            } catch (e) {}
            setTimeout(function () { copyLinkBtn.textContent = 'Copy Link'; }, 2000);
        });
    });

    // ══════════════════════════════════════════════════════════════════════════
    // Helpers
    // ══════════════════════════════════════════════════════════════════════════
    function updateStatus(text, cls) {
        if (statusBadge) {
            statusBadge.textContent = text;
            statusBadge.className = 'badge ' + cls;
        }
        if (wifiIndicator) {
            const isLive = cls === 'badge-live' || cls === 'badge-connected' ||
                (text && (text.toLowerCase().includes('live') || text.toLowerCase().includes('watching') || text.toLowerCase().includes('connected')));
            if (isLive) {
                wifiIndicator.innerHTML = SVG_WIFI_ON;
                wifiIndicator.className = 'indicator-circle wifi-live';
                wifiIndicator.title = text || 'Watching Live';
            } else {
                wifiIndicator.innerHTML = SVG_WIFI_OFF;
                wifiIndicator.className = 'indicator-circle wifi-offline';
                wifiIndicator.title = text || 'Offline';
            }
        }
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

    // ── Live WebRTC Route Inspector (Tailscale vs Cloud vs LAN) ─────────────
    // Inspects connection to verify if using Tailscale (100.x), Cloud Relay, or LAN
    function monitorRoute(connectionObj) {
        if (!connectionObj) return;
        const pc = connectionObj.peerConnection;
        if (!pc) return;
        let lastReportedRoute = '';

        const checkRoute = async function () {
            if (!pc || pc.connectionState === 'closed') return;
            try {
                const stats = await pc.getStats();
                let selectedPair = null;
                stats.forEach(function (report) {
                    if (report.type === 'transport' && report.selectedCandidatePairId) {
                        selectedPair = stats.get(report.selectedCandidatePairId);
                    } else if (report.type === 'candidate-pair' && (report.selected || report.nominated)) {
                        selectedPair = report;
                    }
                });
                if (selectedPair) {
                    const local = selectedPair.localCandidateId ? stats.get(selectedPair.localCandidateId) : null;
                    const remote = selectedPair.remoteCandidateId ? stats.get(selectedPair.remoteCandidateId) : null;
                    const localIp = (local && (local.address || local.ip || local.relatedAddress)) || '';
                    const remoteIp = (remote && (remote.address || remote.ip || remote.relatedAddress)) || '';
                    const localType = (local && local.candidateType) || '';
                    const remoteType = (remote && remote.candidateType) || '';

                    let label = '';
                    let badgeClass = '';
                    let toastClass = '';
                    let icon = '⚡';

                    // Check if either endpoint is using a Tailscale 100.x.x.x private IP
                    if (localIp.startsWith('100.') || remoteIp.startsWith('100.')) {
                        label = 'Tailscale Direct (100.x) • 0 MB Cloud';
                        badgeClass = 'badge-tailscale';
                        toastClass = 'toast-tailscale';
                        icon = '⚡';
                    } else if (localType === 'relay' || remoteType === 'relay') {
                        label = 'Cloud Relay (Metered)';
                        badgeClass = 'badge-relay';
                        toastClass = 'toast-relay';
                        icon = '☁️';
                    } else if (localIp.startsWith('192.168.') || remoteIp.startsWith('192.168.') || localIp.startsWith('10.') || localIp.startsWith('172.')) {
                        label = 'Local Wi-Fi (LAN)';
                        badgeClass = 'badge-connected';
                        toastClass = 'toast-lan';
                        icon = '🏠';
                    } else {
                        label = 'Direct Internet (STUN)';
                        badgeClass = 'badge-connected';
                        toastClass = 'toast-direct';
                        icon = '🌐';
                    }

                    if (label && label !== lastReportedRoute) {
                        lastReportedRoute = label;
                        const fullLabel = icon + ' ' + label;
                        updateRouteBadge(fullLabel, badgeClass);
                        // Show sleek floating bubble in bottom-left corner without polluting live chat
                        showToast('Connection Type', fullLabel, toastClass, 4500);
                    }
                }
            } catch (e) {}
        };

        const interval = setInterval(checkRoute, 2500);
        setTimeout(checkRoute, 1000);
        setTimeout(checkRoute, 3000);
        pc.addEventListener('connectionstatechange', function () {
            if (pc.connectionState === 'closed') clearInterval(interval);
            else checkRoute();
        });
    }

    function updateRouteBadge(text, cls) {
        if (routeBadge) {
            routeBadge.textContent = text;
            routeBadge.className = 'badge ' + cls;
            routeBadge.classList.remove('hidden');
            routeBadge.style.display = 'inline-block';
        }
        if (routeIndicator) {
            const isTailscale = cls === 'badge-tailscale' || (text && text.toLowerCase().includes('tailscale'));
            if (isTailscale) {
                // Blue globe icon for Tailscale
                routeIndicator.innerHTML = SVG_GLOBE;
                routeIndicator.className = 'indicator-circle route-tailscale';
                routeIndicator.title = 'Tailscale Direct (100.x)';
                routeIndicator.classList.remove('hidden');
                routeIndicator.style.display = 'flex';
            } else if (text) {
                // Blue house icon for Direct Internet / LAN
                routeIndicator.innerHTML = SVG_HOUSE;
                routeIndicator.className = 'indicator-circle route-direct';
                routeIndicator.title = text.toLowerCase().includes('lan') ? 'Local Wi-Fi (LAN)' : 'Direct Internet';
                routeIndicator.classList.remove('hidden');
                routeIndicator.style.display = 'flex';
            } else {
                routeIndicator.classList.add('hidden');
                routeIndicator.style.display = 'none';
            }
        }
    }

    // ── Floating Toast Bubble Notification System ─────────────────────────────
    function showToast(title, text, toastClass, duration) {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        // Clean out older toast so messages don't clutter the screen
        while (container.firstChild) {
            container.removeChild(container.firstChild);
        }

        const bubble = document.createElement('div');
        bubble.className = 'toast-bubble ' + (toastClass || '');

        bubble.innerHTML =
            '<div class="toast-content">' +
                '<span class="toast-title">' + esc(title) + '</span>' +
                '<span class="toast-text">' + esc(text) + '</span>' +
            '</div>';

        // Tap/click to dismiss early
        bubble.addEventListener('click', function () {
            bubble.classList.remove('toast-visible');
            bubble.classList.add('toast-hiding');
            setTimeout(function () {
                if (bubble.parentElement) bubble.parentElement.removeChild(bubble);
            }, 300);
        });

        container.appendChild(bubble);

        // Trigger smooth slide-in animation
        requestAnimationFrame(function () {
            bubble.classList.add('toast-visible');
        });

        // Auto dismiss after specified time
        setTimeout(function () {
            if (bubble.parentElement) {
                bubble.classList.remove('toast-visible');
                bubble.classList.add('toast-hiding');
                setTimeout(function () {
                    if (bubble.parentElement) bubble.parentElement.removeChild(bubble);
                }, 300);
            }
        }, duration || 4500);
    }

    function esc(s) {
        return String(s).replace(/[&<>"']/g, function (m) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
        });
    }

}); // end window.load
