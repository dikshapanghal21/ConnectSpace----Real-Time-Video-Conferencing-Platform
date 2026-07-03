import React, { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';
import { Badge, IconButton, Tooltip } from '@mui/material';
import VideocamIcon              from '@mui/icons-material/Videocam';
import VideocamOffIcon           from '@mui/icons-material/VideocamOff';
import CallEndIcon               from '@mui/icons-material/CallEnd';
import MicIcon                   from '@mui/icons-material/Mic';
import MicOffIcon                from '@mui/icons-material/MicOff';
import ScreenShareIcon           from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon       from '@mui/icons-material/StopScreenShare';
import ChatIcon                  from '@mui/icons-material/Chat';
import CloseIcon                 from '@mui/icons-material/Close';
import SendIcon                  from '@mui/icons-material/Send';
import ContentCopyIcon           from '@mui/icons-material/ContentCopy';
import TagFacesIcon              from '@mui/icons-material/TagFaces';
import LinkIcon                  from '@mui/icons-material/Link';
import FiberManualRecordIcon     from '@mui/icons-material/FiberManualRecord';
import StopIcon                  from '@mui/icons-material/Stop';
import PeopleIcon                from '@mui/icons-material/People';
import CheckIcon                 from '@mui/icons-material/Check';
import BlockIcon                 from '@mui/icons-material/Block';
import server from '../environment';
import styles from '../styles/videoComponent.module.css';

const server_url = server;
var connections = {};
const peerConfigConnections = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

const EMOJIS = [
    { emoji: '👍', label: 'Thumbs up' },
    { emoji: '❤️',  label: 'Heart' },
    { emoji: '😂',  label: 'Haha' },
    { emoji: '👏',  label: 'Clap' },
    { emoji: '🎉',  label: 'Party' },
    { emoji: '🔥',  label: 'Fire' },
    { emoji: '😮',  label: 'Wow' },
    { emoji: '🙌',  label: 'Raise hands' },
];

const TILE_COLORS = ['#6366f1','#a855f7','#06b6d4','#22c55e','#f59e0b','#ef4444','#ec4899','#14b8a6'];

function SimpleQR({ text }) {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(text)}&bgcolor=18181b&color=818cf8&format=svg`;
    return <img src={url} alt="QR" width={120} height={120}
        style={{ borderRadius: 6, border: '1px solid #2a2a2f' }}
        onError={e => { e.target.style.display = 'none'; }} />;
}

// ── Stable video element component — never re-mounts ──
const RemoteVideo = React.memo(({ socketId, stream, name, isSpeaking, volume, color, colStart, videoOff, tileRef }) => {
    const ref = useRef();
    useEffect(() => {
        if (ref.current && stream && ref.current.srcObject !== stream) {
            ref.current.srcObject = stream;
            ref.current.play().catch(() => {});
        }
    }, [stream]);
    const initial = name ? name[0].toUpperCase() : '?';
    return (
        <div
            ref={tileRef}
            className={`${styles.tile} ${isSpeaking ? styles.tileSpeaking : ''}`}
            style={colStart ? { gridColumnStart: colStart } : undefined}
        >
            <video ref={ref} autoPlay playsInline className={styles.tileVideo} />
            {(!stream || videoOff) && (
                <div className={styles.tileNoVideo}>
                    <div className={styles.tileAvatar} style={{ background: color + '22', color }}>
                        {initial}
                    </div>
                </div>
            )}
            <div className={styles.volumeBar}>
                <div className={styles.volumeFill} style={{ width: `${volume || 0}%`, background: color }} />
            </div>
            <div className={styles.tileLabel}>
                {isSpeaking && <span className={styles.speakingDot} />}
                <span>{name || 'Guest'}</span>
            </div>
        </div>
    );
}, (prev, next) =>
    prev.stream   === next.stream   &&
    prev.name     === next.name     &&
    prev.isSpeaking === next.isSpeaking &&
    prev.volume   === next.volume   &&
    prev.colStart === next.colStart &&
    prev.videoOff === next.videoOff
);

// ── Spotlight video for an active screen share — object-fit:contain so
//    slides/documents aren't cropped the way a cover-fit camera tile is. ──
const SpotlightRemoteVideo = React.memo(({ stream, name, tileRef }) => {
    const ref = useRef();
    useEffect(() => {
        if (ref.current && stream && ref.current.srcObject !== stream) {
            ref.current.srcObject = stream;
            ref.current.play().catch(() => {});
        }
    }, [stream]);
    return (
        <div ref={tileRef} className={styles.spotlightTile}>
            <video ref={ref} autoPlay playsInline className={styles.spotlightVideo} />
            <div className={styles.presentingBadge}><ScreenShareIcon style={{ fontSize: 14 }} />{name} is presenting</div>
        </div>
    );
});

export default function VideoMeetComponent() {
    // ── Refs ──
    const socketRef        = useRef();
    const socketIdRef      = useRef();
    const localVideoref    = useRef();
    const videoRef         = useRef([]);
    const hideBarTimer     = useRef();
    const messagesEndRef   = useRef();
    const audioContextRef  = useRef();
    const speakerTimers    = useRef({});
    const reactionTimeouts = useRef([]);
    // socketId (or 'local') → tile DOM element. Lets us anchor a floating
    // reaction to the top-right corner of whoever actually sent it.
    const tileElRefs       = useRef({});
    const mediaRecorderRef = useRef();
    const recordedChunks   = useRef([]);
    const rawStreamRef     = useRef();
    const isHostRef        = useRef(false);
    // Store peer names in a ref so socket callbacks never get stale closure
    const peerNamesRef     = useRef({});
    // Mirrors `video` state so socket callbacks (registered once, so they'd
    // otherwise capture a stale value) always read the current camera state.
    const myCamOnRef       = useRef(true);

    // ── State ──
    const [videoAvailable, setVideoAvailable] = useState(true);
    const [audioAvailable, setAudioAvailable] = useState(true);
    const [screenAvailable, setScreenAvailable] = useState(false);
    const [video, setVideo]   = useState(true);
    const [audio, setAudio]   = useState(true);
    const [screen, setScreen] = useState(false);
    useEffect(() => { myCamOnRef.current = video; }, [video]);
    const [videos, setVideos] = useState([]);  // [{socketId, stream, name}]

    // phase: lobby | waiting | connecting | meeting | closed | denied
    const [phase, setPhase]               = useState('lobby');
    const [username, setUsername]         = useState('');
    const [connectingDots, setConnectingDots] = useState('');

    const [showChat, setShowChat]         = useState(false);
    const [messages, setMessages]         = useState([]);
    const [message, setMessage]           = useState('');
    const [newMessages, setNewMessages]   = useState(0);

    const [showBar, setShowBar]           = useState(true);
    const [copied, setCopied]             = useState(false);
    const [showInvite, setShowInvite]     = useState(false);
    const [inviteCopied, setInviteCopied] = useState(false);

    const [activeSpeaker, setActiveSpeaker]   = useState('local');
    const [speakerVolumes, setSpeakerVolumes] = useState({});

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const [floatingReactions, setFloatingReactions] = useState([]);

    // socketId → boolean. Tracks which remote participants are currently
    // sharing their screen, so we know who to spotlight (Zoom-style).
    const [screenSharingPeers, setScreenSharingPeers] = useState({});

    // socketId → boolean. True when that peer has their camera turned off —
    // lets us show a "camera off" placeholder instead of a frozen/black
    // video frame on their tile.
    const [peerVideoOff, setPeerVideoOff] = useState({});

    const [recording, setRecording]         = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const recordingTimerRef                 = useRef();

    const [showParticipants, setShowParticipants] = useState(false);
    const [peerNames, setPeerNames]               = useState({});

    const [waitingList, setWaitingList]       = useState([]);
    const [admissionQueue, setAdmissionQueue] = useState([]);

    // ══════════════════════════════════════
    //  LOBBY INIT
    // ══════════════════════════════════════
    useEffect(() => {
        const init = async () => {
            try { const v = await navigator.mediaDevices.getUserMedia({ video: true }); setVideoAvailable(true); v.getTracks().forEach(t => t.stop()); } catch { setVideoAvailable(false); }
            try { const a = await navigator.mediaDevices.getUserMedia({ audio: true }); setAudioAvailable(true); a.getTracks().forEach(t => t.stop()); } catch { setAudioAvailable(false); }
            setScreenAvailable(!!navigator.mediaDevices.getDisplayMedia);
            try {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                rawStreamRef.current = stream;
                window.localStream = stream;
                if (localVideoref.current) { localVideoref.current.srcObject = stream; localVideoref.current.play().catch(() => {}); }
            } catch (e) { console.log('Preview error', e); }
        };
        init();
        return () => { rawStreamRef.current?.getTracks().forEach(t => t.stop()); window.localStream = null; };
    }, []);

    // connecting dots
    useEffect(() => {
        if (phase !== 'connecting') return;
        let c = 0;
        const iv = setInterval(() => { c = (c + 1) % 4; setConnectingDots('.'.repeat(c)); }, 400);
        return () => clearInterval(iv);
    }, [phase]);

    // auto-hide bar
    const resetHideTimer = useCallback(() => {
        setShowBar(true);
        clearTimeout(hideBarTimer.current);
        hideBarTimer.current = setTimeout(() => setShowBar(false), 4000);
    }, []);
    useEffect(() => {
        if (phase !== 'meeting') return;
        resetHideTimer();
        return () => clearTimeout(hideBarTimer.current);
    }, [phase, resetHideTimer]);

    // chat scroll
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    // ── Active speaker: local ──
    useEffect(() => {
        if (phase !== 'meeting' || !window.localStream) return;
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.3;
        try { ctx.createMediaStreamSource(window.localStream).connect(analyser); } catch { return; }
        const data = new Uint8Array(analyser.frequencyBinCount);
        let id;
        const tick = () => {
            analyser.getByteFrequencyData(data);
            const vol = Math.min(100, Math.round((data.reduce((s, v) => s + v, 0) / data.length) * 2));
            setSpeakerVolumes(p => ({ ...p, local: vol }));
            if (vol > 12) {
                setActiveSpeaker('local');
                clearTimeout(speakerTimers.current.local);
                speakerTimers.current.local = setTimeout(() => setActiveSpeaker(p => p === 'local' ? null : p), 1500);
            }
            id = requestAnimationFrame(tick);
        };
        id = requestAnimationFrame(tick);
        return () => { cancelAnimationFrame(id); ctx.close().catch(() => {}); };
    }, [phase]);

    const monitorRemoteStream = useCallback((socketId, stream) => {
        if (!audioContextRef.current) return;
        try {
            const analyser = audioContextRef.current.createAnalyser();
            analyser.fftSize = 512; analyser.smoothingTimeConstant = 0.3;
            audioContextRef.current.createMediaStreamSource(stream).connect(analyser);
            const data = new Uint8Array(analyser.frequencyBinCount);
            let id;
            const tick = () => {
                analyser.getByteFrequencyData(data);
                const vol = Math.min(100, Math.round((data.reduce((s, v) => s + v, 0) / data.length) * 2));
                setSpeakerVolumes(p => ({ ...p, [socketId]: vol }));
                if (vol > 12) {
                    setActiveSpeaker(socketId);
                    clearTimeout(speakerTimers.current[socketId]);
                    speakerTimers.current[socketId] = setTimeout(() => setActiveSpeaker(p => p === socketId ? null : p), 1500);
                }
                id = requestAnimationFrame(tick);
            };
            id = requestAnimationFrame(tick);
            // Store cancel fn
            speakerTimers.current[socketId + '_cancel'] = () => cancelAnimationFrame(id);
        } catch (e) {}
    }, []);

    // ── Recording ──
    const startRecording = useCallback(() => {
        if (!window.localStream) return;
        recordedChunks.current = [];
        const save = (chunks, type) => {
            const blob = new Blob(chunks, { type });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = `ConnectSpace-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        };
        const start = (mr) => {
            mr.ondataavailable = e => { if (e.data.size > 0) recordedChunks.current.push(e.data); };
            mr.onstop = () => save(recordedChunks.current, 'video/webm');
            mr.start(1000); mediaRecorderRef.current = mr;
            setRecording(true); setRecordingTime(0);
            recordingTimerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
        };
        try { start(new MediaRecorder(window.localStream, { mimeType: 'video/webm;codecs=vp9,opus' })); }
        catch { try { start(new MediaRecorder(window.localStream)); } catch { alert('Recording not supported.'); } }
    }, []);
    const stopRecording = useCallback(() => {
        mediaRecorderRef.current?.stop(); setRecording(false); clearInterval(recordingTimerRef.current);
    }, []);
    const fmtTime = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    // ── Reactions ──
    const spawnReaction = useCallback((emoji, sender, fromSocketId) => {
        const id = Date.now() + Math.random();
        const el = tileElRefs.current[fromSocketId];
        // Anchor near the top-right corner of that participant's tile.
        // Fall back to the viewport's top-right if we can't find their
        // tile (e.g. it hasn't rendered yet, or they're off-screen in a
        // scrolled thumbnail strip).
        let left = window.innerWidth - 70, top = 40;
        if (el) {
            const rect = el.getBoundingClientRect();
            left = rect.right - 38;
            top  = rect.top + 10;
        }
        setFloatingReactions(p => [...p, { id, emoji, sender, left, top }]);
        const t = setTimeout(() => setFloatingReactions(p => p.filter(r => r.id !== id)), 10000); // visible for 10s
        reactionTimeouts.current.push(t);
    }, []);
    useEffect(() => () => reactionTimeouts.current.forEach(clearTimeout), []);
    const sendReaction = emoji => {
        setShowEmojiPicker(false);
        socketRef.current?.emit('reaction', emoji, username);
        spawnReaction(emoji, username, 'local');
    };

    // ── Lobby toggles ──
    const toggleLobbyVideo = () => { const v = !video; setVideo(v); rawStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = v; }); };
    const toggleLobbyAudio = () => { const a = !audio; setAudio(a); rawStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = a; }); };

    // ── Join ──
    const handleJoin = async () => {
        if (!username.trim()) return;
        if (!rawStreamRef.current || rawStreamRef.current.getTracks().every(t => t.readyState === 'ended')) {
            try { const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: true }); rawStreamRef.current = s; window.localStream = s; }
            catch (e) { console.log(e); }
        } else { window.localStream = rawStreamRef.current; }
        setPhase('connecting');
        setTimeout(() => connectToSocketServer(), 800);
    };

    // ── In-meeting controls ──
    const handleVideo = () => {
        const v = !video; setVideo(v);
        window.localStream?.getVideoTracks().forEach(t => { t.enabled = v; });
        socketRef.current?.emit('video-status', v);
    };
    const handleAudio = () => { const a = !audio; setAudio(a); window.localStream?.getAudioTracks().forEach(t => { t.enabled = a; }); };

    const renegotiateStream = async (newStream) => {
        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            try {
                const senders = connections[id].getSenders();
                const vt = newStream.getVideoTracks()[0], at = newStream.getAudioTracks()[0];
                if (vt) { const vs = senders.find(s => s.track?.kind === 'video'); if (vs) await vs.replaceTrack(vt); }
                if (at) { const as = senders.find(s => s.track?.kind === 'audio'); if (as) await as.replaceTrack(at); }
            } catch (e) {}
        }
    };

    const handleScreen = async () => {
        if (!screen) {
            try {
                const ds = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
                window.localStream = ds;
                if (localVideoref.current) localVideoref.current.srcObject = ds;
                await renegotiateStream(ds);
                ds.getTracks().forEach(t => {
                    // Fires both on our own "Stop sharing" click and when the
                    // user stops it via the browser's native sharing toolbar.
                    t.onended = () => { setScreen(false); socketRef.current?.emit('screen-share-status', false); restoreCamera(); };
                });
                setScreen(true);
                socketRef.current?.emit('screen-share-status', true);
            } catch (e) {}
        } else {
            setScreen(false);
            socketRef.current?.emit('screen-share-status', false);
            restoreCamera();
        }
    };

    const restoreCamera = async () => {
        try {
            const s = rawStreamRef.current?.getTracks().some(t => t.readyState === 'live')
                ? rawStreamRef.current
                : await navigator.mediaDevices.getUserMedia({ video, audio });
            rawStreamRef.current = s; window.localStream = s;
            if (localVideoref.current) { localVideoref.current.srcObject = s; localVideoref.current.play().catch(() => {}); }
            await renegotiateStream(s);
        } catch (e) {}
    };

    const handleEndCall = () => {
        stopRecording();
        if (isHostRef.current) socketRef.current?.emit('close-room', window.location.href);
        rawStreamRef.current?.getTracks().forEach(t => t.stop()); window.localStream = null;
        socketRef.current?.disconnect();
        audioContextRef.current?.close().catch(() => {});
        window.location.href = '/home';
    };

    const handleCopyLink   = () => { navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); };
    const handleInviteCopy = () => { navigator.clipboard.writeText(window.location.href); setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000); };

    const admitUser = id => { socketRef.current?.emit('admit-user', window.location.href, id); setAdmissionQueue(q => q.filter(r => r.socketId !== id)); };
    const denyUser  = id => { socketRef.current?.emit('deny-user',  window.location.href, id); setAdmissionQueue(q => q.filter(r => r.socketId !== id)); };

    // ══════════════════════════════════════
    //  SOCKET / WEBRTC
    // ══════════════════════════════════════
    const connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false });

        socketRef.current.on('signal', (fromId, msg) => {
            const signal = JSON.parse(msg);
            if (fromId === socketIdRef.current || !connections[fromId]) return;
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(() => {
                    if (signal.sdp.type === 'offer') {
                        connections[fromId].createAnswer().then(desc => {
                            connections[fromId].setLocalDescription(desc).then(() => {
                                socketRef.current.emit('signal', fromId, JSON.stringify({ sdp: connections[fromId].localDescription }));
                            });
                        });
                    }
                }).catch(console.log);
            }
            if (signal.ice) connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch(console.log);
        });

        socketRef.current.on('connect', () => {
            socketIdRef.current = socketRef.current.id;
            socketRef.current.emit('join-call', window.location.href, username);
        });

        // ── Room states ──
        socketRef.current.on('room-closed', () => {
            rawStreamRef.current?.getTracks().forEach(t => t.stop());
            socketRef.current?.disconnect(); setPhase('closed');
        });
        socketRef.current.on('waiting-for-admission', () => setPhase('waiting'));
        socketRef.current.on('admission-denied', () => setPhase('denied'));

        socketRef.current.on('admission-granted', () => {
            setPhase('meeting');
            setTimeout(() => {
                if (localVideoref.current && window.localStream) {
                    localVideoref.current.srcObject = window.localStream;
                    localVideoref.current.play().catch(() => {});
                }
            }, 100);
            setupMeetingListeners();
        });

        // ── Admission queue (host only) ──
        socketRef.current.on('admission-request', req => setAdmissionQueue(q => [...q.filter(r => r.socketId !== req.socketId), req]));
        socketRef.current.on('waiting-list-update', list => setWaitingList(list));
    };

    const setupMeetingListeners = () => {
        socketRef.current.emit('announce-name', username);
        socketRef.current.emit('video-status', myCamOnRef.current);

        socketRef.current.on('chat-message', (data, sender, socketIdSender) => {
            setMessages(p => [...p, { sender, data, time: new Date() }]);
            if (socketIdSender !== socketIdRef.current) setNewMessages(p => p + 1);
        });

        // ── NAME FIX: update peerNamesRef + state + videos atomically ──
        socketRef.current.on('peer-name', (socketId, name) => {
            peerNamesRef.current[socketId] = name;
            setPeerNames(p => ({ ...p, [socketId]: name }));
            // Update the name inside the videos array so RemoteVideo re-renders
            setVideos(prev => prev.map(v => v.socketId === socketId ? { ...v, name } : v));
        });

        socketRef.current.on('user-left', id => {
            setVideos(prev => prev.filter(v => v.socketId !== id));
            setPeerNames(p => { const n = { ...p }; delete n[id]; return n; });
            delete peerNamesRef.current[id];
            setScreenSharingPeers(p => { if (!(id in p)) return p; const n = { ...p }; delete n[id]; return n; });
            setPeerVideoOff(p => { if (!(id in p)) return p; const n = { ...p }; delete n[id]; return n; });
            if (speakerTimers.current[id + '_cancel']) speakerTimers.current[id + '_cancel']();
        });

        socketRef.current.on('reaction', (emoji, sender, fromSocketId) => spawnReaction(emoji, sender, fromSocketId));
        socketRef.current.on('screen-share-status', (fromSocketId, sharing) => {
            setScreenSharingPeers(p => ({ ...p, [fromSocketId]: sharing }));
        });
        socketRef.current.on('video-status', (fromSocketId, isOn) => {
            setPeerVideoOff(p => ({ ...p, [fromSocketId]: !isOn }));
        });

        socketRef.current.on('user-joined', (id, clients) => {
            // First user-joined where we are the only client → we're host
            if (id === socketIdRef.current && clients.length === 1) {
                isHostRef.current = true;
            }

            // Someone new joined — let them know our current camera state
            // right away, since they won't have received our earlier
            // announcement (it went out before they connected).
            if (id !== socketIdRef.current) {
                socketRef.current.emit('video-status', myCamOnRef.current);
            }

            clients.forEach(socketListId => {
                if (connections[socketListId]) return;
                connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

                connections[socketListId].onicecandidate = event => {
                    if (event.candidate)
                        socketRef.current.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }));
                };

                connections[socketListId].onaddstream = event => {
                    // NAME FIX: read from ref so we always have the latest name
                    const name = peerNamesRef.current[socketListId] || '';
                    setVideos(prev => {
                        const exists = prev.find(v => v.socketId === socketListId);
                        if (exists) return prev.map(v => v.socketId === socketListId ? { ...v, stream: event.stream } : v);
                        return [...prev, { socketId: socketListId, stream: event.stream, name }];
                    });
                    videoRef.current = videoRef.current.filter(v => v.socketId !== socketListId);
                    videoRef.current.push({ socketId: socketListId });
                    setTimeout(() => monitorRemoteStream(socketListId, event.stream), 500);
                };

                if (window.localStream) {
                    connections[socketListId].addStream(window.localStream);
                } else {
                    const silence = () => { const c = new AudioContext(); const o = c.createOscillator(); const d = o.connect(c.createMediaStreamDestination()); o.start(); c.resume(); return Object.assign(d.stream.getAudioTracks()[0], { enabled: false }); };
                    const black   = () => { const cv = Object.assign(document.createElement('canvas'), { width: 640, height: 480 }); cv.getContext('2d').fillRect(0, 0, 640, 480); return Object.assign(cv.captureStream().getVideoTracks()[0], { enabled: false }); };
                    window.localStream = new MediaStream([black(), silence()]);
                    connections[socketListId].addStream(window.localStream);
                }
            });

            if (id === socketIdRef.current) {
                for (let id2 in connections) {
                    if (id2 === socketIdRef.current) continue;
                    try { connections[id2].addStream(window.localStream); } catch (e) {}
                    connections[id2].createOffer().then(desc => {
                        connections[id2].setLocalDescription(desc).then(() => {
                            socketRef.current.emit('signal', id2, JSON.stringify({ sdp: connections[id2].localDescription }));
                        });
                    });
                }
            }
        });
    };

    // ── Chat ──
    const sendMessage = () => { if (!message.trim()) return; socketRef.current?.emit('chat-message', message, username); setMessage(''); };
    const openChat    = () => { setShowChat(true); setNewMessages(0); };
    const formatTime  = d => d?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const groupedMessages = messages.reduce((acc, msg, i) => {
        const prev = messages[i - 1];
        const same = prev && prev.sender === msg.sender && (new Date(msg.time) - new Date(prev.time)) < 60000;
        if (same) acc[acc.length - 1].msgs.push(msg); else acc.push({ sender: msg.sender, msgs: [msg] });
        return acc;
    }, []);

    // Zoom-style grid layout — returns cols, rows, and whether last row is short
    const getZoomGrid = (total) => {
        if (total === 1)  return { cols: 1, rows: 1 };
        if (total === 2)  return { cols: 2, rows: 1 };
        if (total === 3)  return { cols: 2, rows: 2 }; // 2 top + 1 centered bottom
        if (total === 4)  return { cols: 2, rows: 2 };
        if (total === 5)  return { cols: 3, rows: 2 }; // 3 top + 2 centered bottom
        if (total === 6)  return { cols: 3, rows: 2 };
        if (total <= 9)   return { cols: 3, rows: 3 };
        if (total <= 12)  return { cols: 4, rows: 3 };
        return { cols: 4, rows: Math.ceil(total / 4) };
    };

    const allParticipants = [
        { socketId: 'local', name: username || 'You', isLocal: true, isHost: isHostRef.current },
        ...videos.map(v => ({ socketId: v.socketId, name: v.name || peerNames[v.socketId] || 'Guest', isLocal: false }))
    ];
    const totalTiles = allParticipants.length;
    const { cols, rows } = getZoomGrid(totalTiles);
    // How many tiles fill the last row fully
    const tilesInLastRow = totalTiles % cols === 0 ? cols : totalTiles % cols;
    const lastRowShort   = tilesInLastRow !== cols; // true when last row has fewer tiles

    // ── Screen share spotlight ──
    // Local sharing takes priority for our own view; otherwise spotlight
    // the first remote peer whose screen-share-status came through as true.
    // (Simple mesh call: only one video track per peer, so a presenter's
    // camera feed is replaced by the screen for the duration of the share
    // — same tradeoff most lightweight WebRTC clones make. A "camera +
    // screen simultaneously" view like Zoom's needs a second video track
    // per peer, which is a bigger signaling change.)
    const remoteSpotlightId = Object.keys(screenSharingPeers).find(id => screenSharingPeers[id]);
    const spotlightId = screen ? 'local' : remoteSpotlightId;
    const spotlightName = spotlightId === 'local'
        ? (username || 'You')
        : (peerNames[spotlightId] || allParticipants.find(p => p.socketId === spotlightId)?.name || 'Someone');
    const thumbParticipants = allParticipants.filter(p => p.socketId !== spotlightId);

    // Local <video> element moves between the grid and the spotlight main
    // stage depending on layout — since that's a DOM remount, the browser
    // drops srcObject, so re-attach it whenever the layout changes.
    useEffect(() => {
        if (localVideoref.current && window.localStream) {
            localVideoref.current.srcObject = window.localStream;
            localVideoref.current.play().catch(() => {});
        }
    }, [spotlightId]);

    // ══════════════════════════════════════
    //  LOBBY
    // ══════════════════════════════════════
    if (phase === 'lobby') return (
        <div className={styles.lobbyContainer}>
            <div className={styles.lobbyLeft}>
                <div className={styles.lobbyPreview}>
                    <video ref={localVideoref} autoPlay muted playsInline className={styles.lobbyVideo} style={{ transform: 'scaleX(-1)' }} />
                    {!video && <div className={styles.videoOff}><VideocamOffIcon style={{ fontSize: 36, color: '#55555f' }} /><span>Camera off</span></div>}
                    <div className={styles.lobbyPreviewControls}>
                        <IconButton onClick={toggleLobbyVideo} className={styles.lobbyCtrlBtn}>{video ? <VideocamIcon /> : <VideocamOffIcon style={{ color: '#dc4040' }} />}</IconButton>
                        <IconButton onClick={toggleLobbyAudio} className={styles.lobbyCtrlBtn}>{audio ? <MicIcon /> : <MicOffIcon style={{ color: '#dc4040' }} />}</IconButton>
                    </div>
                </div>
            </div>
            <div className={styles.lobbyRight}>
                <div className={styles.lobbyBrand}>ConnectSpace</div>
                <h2 className={styles.lobbyTitle}>Ready to join?</h2>
                <p className={styles.lobbySubtitle}>Enter your name. If a host is already present, you'll wait for approval.</p>
                <div className={styles.lobbyDeviceStatus}>
                    <div className={styles.deviceRow}><span className={`${styles.deviceDot} ${videoAvailable ? styles.dotGreen : styles.dotRed}`} /><span>{videoAvailable ? 'Camera ready' : 'No camera found'}</span></div>
                    <div className={styles.deviceRow}><span className={`${styles.deviceDot} ${audioAvailable ? styles.dotGreen : styles.dotRed}`} /><span>{audioAvailable ? 'Microphone ready' : 'No microphone found'}</span></div>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.75rem', color: '#55555f', display: 'block', marginBottom: 5 }}>Your display name</label>
                    <input value={username} onChange={e => setUsername(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleJoin()}
                        placeholder="Enter your name" autoFocus
                        style={{ width: '100%', padding: '9px 12px', background: '#18181b', border: '1px solid #2a2a2f', borderRadius: 6, color: '#f0f0f2', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                        onFocus={e => e.target.style.borderColor = '#5b5fc7'} onBlur={e => e.target.style.borderColor = '#2a2a2f'} />
                </div>
                <button className={styles.joinBtn} onClick={handleJoin} disabled={!username.trim()}>Join now</button>
                <div className={styles.lobbyInviteBox}>
                    <div className={styles.lobbyInviteRow}><LinkIcon style={{ fontSize: 14, color: '#5b5fc7' }} /><span className={styles.lobbyInviteLabel}>Invite link</span></div>
                    <div className={styles.lobbyInviteUrl}><span>{window.location.href}</span><button className={styles.lobbyInviteCopy} onClick={handleCopyLink}>{copied ? '✓ Copied' : 'Copy'}</button></div>
                </div>
            </div>
        </div>
    );

    if (phase === 'waiting') return (
        <div className={styles.connectingScreen}>
            <div className={styles.connectingCard}>
                <div style={{ fontSize: '2.2rem', marginBottom: '1.2rem' }}>🕐</div>
                <h3 className={styles.connectingText}>Waiting for admission</h3>
                <p className={styles.connectingSubtext}>The host needs to let you in. Please wait…</p>
                <div style={{ marginTop: '1rem', padding: '8px 14px', background: 'rgba(91,95,199,0.08)', border: '1px solid rgba(91,95,199,0.2)', borderRadius: 6, fontSize: '0.82rem', color: '#818cf8', textAlign: 'center' }}>{username}</div>
                <button onClick={() => { socketRef.current?.disconnect(); setPhase('lobby'); }}
                    style={{ marginTop: '1.2rem', background: 'transparent', border: '1px solid #2a2a2f', color: '#8b8b99', fontSize: '0.82rem', padding: '6px 18px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
            </div>
        </div>
    );

    if (phase === 'denied') return (
        <div className={styles.connectingScreen}>
            <div className={styles.connectingCard}>
                <div style={{ fontSize: '2.2rem', marginBottom: '1.2rem' }}>🚫</div>
                <h3 className={styles.connectingText}>Entry denied</h3>
                <p className={styles.connectingSubtext}>The host did not let you in.</p>
                <button onClick={() => window.location.href = '/home'}
                    style={{ marginTop: '1rem', background: '#5b5fc7', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 500, padding: '8px 22px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Back to home</button>
            </div>
        </div>
    );

    if (phase === 'closed') return (
        <div className={styles.connectingScreen}>
            <div className={styles.connectingCard}>
                <div style={{ fontSize: '2.2rem', marginBottom: '1.2rem' }}>🔒</div>
                <h3 className={styles.connectingText}>Meeting ended</h3>
                <p className={styles.connectingSubtext}>The host has ended this meeting.</p>
                <button onClick={() => window.location.href = '/home'}
                    style={{ marginTop: '1rem', background: '#5b5fc7', border: 'none', color: '#fff', fontSize: '0.85rem', fontWeight: 500, padding: '8px 22px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>Back to home</button>
            </div>
        </div>
    );

    if (phase === 'connecting') return (
        <div className={styles.connectingScreen}>
            <div className={styles.connectingCard}>
                <div className={styles.connectingSpinner}><div className={styles.spinRing} /></div>
                <h3 className={styles.connectingText}>Joining{connectingDots}</h3>
                <p className={styles.connectingSubtext}>Setting up your connection</p>
                <div className={styles.connectingSteps}>
                    <div className={`${styles.connectingStep} ${styles.stepDone}`}><span className={styles.stepIcon}>✓</span> Permissions granted</div>
                    <div className={`${styles.connectingStep} ${styles.stepActive}`}><span className={styles.stepIcon}>⟳</span> Connecting to room</div>
                    <div className={styles.connectingStep}><span className={styles.stepIcon}>○</span> Ready to call</div>
                </div>
            </div>
        </div>
    );

    // ══════════════════════════════════════
    //  MEETING ROOM
    // ══════════════════════════════════════
    const sideOpen = showChat || showParticipants;

    return (
        <div className={styles.meetingRoot} onMouseMove={resetHideTimer} onTouchStart={resetHideTimer}>

            {/* ── Floating reactions ── */}
            <div className={styles.reactionsLayer}>
                {floatingReactions.map(r => (
                    <div key={r.id} className={styles.floatingReaction} style={{ left: r.left, top: r.top }}>
                        <span className={styles.floatingEmoji}>{r.emoji}</span>
                        <span className={styles.floatingSender}>{r.sender}</span>
                    </div>
                ))}
            </div>

            {/* ── Recording badge ── */}
            {recording && <div className={styles.recordingBadge}><span className={styles.recDot} /> REC {fmtTime(recordingTime)}</div>}

            {/* ── Admission toasts (host only) ── */}
            {admissionQueue.map((req, i) => (
                <div key={req.socketId} className={styles.admissionToast} style={{ bottom: `${88 + i * 78}px` }}>
                    <div className={styles.admissionInfo}>
                        <div className={styles.admissionAvatar}>{req.username?.[0]?.toUpperCase() || '?'}</div>
                        <div>
                            <div className={styles.admissionName}>{req.username}</div>
                            <div className={styles.admissionSub}>wants to join</div>
                        </div>
                    </div>
                    <div className={styles.admissionBtns}>
                        <button className={styles.admitBtn} onClick={() => admitUser(req.socketId)}><CheckIcon style={{ fontSize: 13 }} /> Admit</button>
                        <button className={styles.denyBtn}  onClick={() => denyUser(req.socketId)}><BlockIcon  style={{ fontSize: 13 }} /> Deny</button>
                    </div>
                </div>
            ))}

            {/* ── Main layout: tiles + side panel ── */}
            <div className={styles.meetingLayout}>

                {/* ── Video area: spotlight (someone's screen sharing) or grid ── */}
                <div className={styles.videoArea}>
                    {spotlightId ? (
                        <div className={styles.spotlightLayout}>
                            {/* ── Main stage: the shared screen ── */}
                            <div className={styles.spotlightMain}>
                                {spotlightId === 'local' ? (
                                    <div ref={el => { tileElRefs.current['local'] = el; }} className={styles.spotlightTile}>
                                        <video ref={localVideoref} autoPlay muted playsInline className={styles.spotlightVideo} />
                                        <div className={styles.presentingBadge}><ScreenShareIcon style={{ fontSize: 14 }} /> You are presenting</div>
                                        <button className={styles.spotlightStopBtn} onClick={handleScreen}>
                                            <StopScreenShareIcon style={{ fontSize: 15 }} /> Stop sharing
                                        </button>
                                    </div>
                                ) : (
                                    <SpotlightRemoteVideo
                                        stream={videos.find(v => v.socketId === spotlightId)?.stream}
                                        name={spotlightName}
                                        tileRef={el => { tileElRefs.current[spotlightId] = el; }}
                                    />
                                )}
                            </div>

                            {/* ── Thumbnail strip: everyone else, small ── */}
                            <div className={styles.spotlightThumbs}>
                                {thumbParticipants.map((p) => {
                                    if (p.isLocal) {
                                        return (
                                            <div key="local" ref={el => { tileElRefs.current['local'] = el; }} className={`${styles.thumbTile} ${activeSpeaker === 'local' ? styles.tileSpeaking : ''}`}>
                                                <div className={styles.thumbCameraPlaceholder}>
                                                    <div className={styles.tileAvatar} style={{ background: '#6366f122', color: '#6366f1', width: 32, height: 32, fontSize: '0.8rem' }}>
                                                        {username ? username[0].toUpperCase() : 'Y'}
                                                    </div>
                                                </div>
                                                <div className={styles.tileLabel}>
                                                    <span>{username || 'You'}</span>
                                                    <span className={styles.tileLabelYou}>(you)</span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    const v   = videos.find(vv => vv.socketId === p.socketId);
                                    const col = TILE_COLORS[thumbParticipants.indexOf(p) % TILE_COLORS.length];
                                    return (
                                        <RemoteVideo
                                            key={p.socketId}
                                            socketId={p.socketId}
                                            stream={v?.stream}
                                            name={p.name}
                                            isSpeaking={activeSpeaker === p.socketId}
                                            volume={Math.round((speakerVolumes[p.socketId] || 0) / 10) * 10}
                                            color={col}
                                            videoOff={!!peerVideoOff[p.socketId]}
                                            tileRef={el => { tileElRefs.current[p.socketId] = el; }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        /* Zoom-style grid — tiles fill rows evenly, short last row is centered */
                        <div className={styles.zoomGrid} style={{
                            gridTemplateColumns: `repeat(${cols}, 1fr)`,
                            gridTemplateRows:    `repeat(${rows}, 1fr)`,
                        }}>
                            {/* Local tile — always index 0 */}
                            {(() => {
                                // For the local tile: does it start the short last row?
                                const isOrphan = lastRowShort && 0 >= totalTiles - tilesInLastRow;
                                // col offset to center orphan tiles: e.g. 1 tile in 2-col grid → start at col 1 (the middle)
                                const orphanOffset = lastRowShort ? Math.floor((cols - tilesInLastRow) / 2) : 0;
                                const colStart = isOrphan && orphanOffset > 0 ? orphanOffset + 1 : undefined;
                                return (
                                    <div
                                        ref={el => { tileElRefs.current['local'] = el; }}
                                        className={`${styles.tile} ${activeSpeaker === 'local' ? styles.tileSpeaking : ''}`}
                                        style={colStart ? { gridColumnStart: colStart } : undefined}
                                    >
                                        <video ref={localVideoref} autoPlay muted playsInline className={styles.tileVideo} style={{ transform: screen ? 'none' : 'scaleX(-1)' }} />
                                        {!video && (
                                            <div className={styles.tileNoVideo}>
                                                <div className={styles.tileAvatar} style={{ background: '#6366f122', color: '#6366f1' }}>
                                                    {username ? username[0].toUpperCase() : 'Y'}
                                                </div>
                                            </div>
                                        )}
                                        <div className={styles.volumeBar}><div className={styles.volumeFill} style={{ width: `${speakerVolumes['local'] || 0}%` }} /></div>
                                        <div className={styles.tileLabel}>
                                            {activeSpeaker === 'local' && <span className={styles.speakingDot} />}
                                            <span>{username || 'You'}</span>
                                            {isHostRef.current && <span className={styles.hostBadge}>Host</span>}
                                            <span className={styles.tileLabelYou}>(you)</span>
                                        </div>
                                        {!audio && <div className={styles.tileMuted}><MicOffIcon style={{ fontSize: 13 }} /></div>}
                                    </div>
                                );
                            })()}

                            {/* Remote tiles */}
                            {videos.map((v, i) => {
                                const absIdx       = i + 1;
                                const col          = TILE_COLORS[absIdx % TILE_COLORS.length];
                                const name         = v.name || peerNames[v.socketId] || `Guest ${i + 1}`;
                                const vol          = Math.round((speakerVolumes[v.socketId] || 0) / 10) * 10;
                                const orphanOffset = lastRowShort ? Math.floor((cols - tilesInLastRow) / 2) : 0;
                                const isOrphan     = lastRowShort && absIdx >= totalTiles - tilesInLastRow;
                                const posInRow     = absIdx - (totalTiles - tilesInLastRow);
                                const colStart     = isOrphan && orphanOffset > 0 && posInRow === 0 ? orphanOffset + 1 : undefined;
                                return (
                                    <RemoteVideo
                                        key={v.socketId}
                                        socketId={v.socketId}
                                        stream={v.stream}
                                        name={name}
                                        isSpeaking={activeSpeaker === v.socketId}
                                        volume={vol}
                                        color={col}
                                        colStart={colStart}
                                        videoOff={!!peerVideoOff[v.socketId]}
                                        tileRef={el => { tileElRefs.current[v.socketId] = el; }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* ── Side panel: participants or chat ── */}
                {sideOpen && (
                    <div className={styles.sidePanel}>
                        {showParticipants && (
                            <>
                                <div className={styles.sidePanelHeader}>
                                    <div>
                                        <div className={styles.sidePanelTitle}>Participants</div>
                                        <div className={styles.sidePanelSub}>{allParticipants.length} in call{waitingList.length > 0 ? `, ${waitingList.length} waiting` : ''}</div>
                                    </div>
                                    <IconButton size="small" onClick={() => setShowParticipants(false)} sx={{ color: '#55555f' }}><CloseIcon fontSize="small" /></IconButton>
                                </div>
                                <div className={styles.sidePanelBody}>
                                    {/* Waiting list — host only */}
                                    {waitingList.length > 0 && (
                                        <>
                                            <div className={styles.participantSectionLabel}>Waiting ({waitingList.length})</div>
                                            {waitingList.map(u => (
                                                <div key={u.socketId} className={styles.participantRow} style={{ borderColor: 'rgba(245,158,11,0.15)', background: 'rgba(245,158,11,0.04)' }}>
                                                    <div className={styles.participantAvatar} style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                                                        {u.username?.[0]?.toUpperCase() || '?'}
                                                    </div>
                                                    <div className={styles.participantName}>{u.username}</div>
                                                    <div style={{ display: 'flex', gap: 4 }}>
                                                        <button onClick={() => admitUser(u.socketId)} style={{ background: 'rgba(61,154,90,0.12)', border: '1px solid rgba(61,154,90,0.22)', color: '#4ade80', fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }}>Admit</button>
                                                        <button onClick={() => denyUser(u.socketId)}  style={{ background: 'rgba(220,64,64,0.08)', border: '1px solid rgba(220,64,64,0.18)', color: '#f87171', fontSize: '0.68rem', padding: '2px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: 'inherit' }}>Deny</button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div style={{ height: 1, background: '#2a2a2f', margin: '10px 0' }} />
                                            <div className={styles.participantSectionLabel}>In meeting ({allParticipants.length})</div>
                                        </>
                                    )}
                                    {/* In-call list */}
                                    {allParticipants.map((p, i) => {
                                        const col = p.isLocal ? TILE_COLORS[0] : TILE_COLORS[i % TILE_COLORS.length];
                                        const isSpeakingNow = activeSpeaker === (p.isLocal ? 'local' : p.socketId);
                                        return (
                                            <div key={p.socketId} className={styles.participantRow}>
                                                <div className={styles.participantAvatar} style={{ background: col + '22', color: col }}>
                                                    {p.name?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div className={styles.participantName}>
                                                    {p.name}
                                                    {p.isHost && <span className={styles.hostBadge}>Host</span>}
                                                    {p.isLocal && <span style={{ fontSize: '0.65rem', color: '#35353c', marginLeft: 4 }}>(you)</span>}
                                                </div>
                                                {isSpeakingNow && <span className={styles.speakingDot} style={{ marginLeft: 'auto' }} />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {showChat && (
                            <>
                                <div className={styles.sidePanelHeader}>
                                    <div>
                                        <div className={styles.sidePanelTitle}>In-call chat</div>
                                        <div className={styles.sidePanelSub}>{messages.length} message{messages.length !== 1 ? 's' : ''}</div>
                                    </div>
                                    <IconButton size="small" onClick={() => setShowChat(false)} sx={{ color: '#55555f' }}><CloseIcon fontSize="small" /></IconButton>
                                </div>
                                <div className={styles.chatMessages}>
                                    {messages.length === 0 ? (
                                        <div className={styles.chatEmpty}>
                                            <ChatIcon style={{ fontSize: 28, color: '#2a2a2f', marginBottom: 6 }} />
                                            <p>No messages yet</p><span>Start the conversation</span>
                                        </div>
                                    ) : groupedMessages.map((group, gi) => {
                                        const isMe = group.sender === username;
                                        const col  = TILE_COLORS[gi % TILE_COLORS.length];
                                        return (
                                            <div key={gi} className={`${styles.msgGroup} ${isMe ? styles.msgGroupMe : ''}`}>
                                                {!isMe && <div className={styles.msgAvatar} style={{ background: col + '22', color: col }}>{group.sender?.[0]?.toUpperCase()}</div>}
                                                <div className={styles.msgContent}>
                                                    {!isMe && <div className={styles.chatSender}>{group.sender}</div>}
                                                    {group.msgs.map((m, mi) => (
                                                        <div key={mi} className={styles.chatBubbleWrap}>
                                                            <div className={`${styles.chatBubble} ${isMe ? styles.chatBubbleMe : ''}`}>{m.data}</div>
                                                            {mi === group.msgs.length - 1 && <div className={styles.chatTime}>{formatTime(m.time)}</div>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <div ref={messagesEndRef} />
                                </div>
                                <div className={styles.chatInputRow}>
                                    <input value={message} onChange={e => setMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()}
                                        placeholder="Type a message…"
                                        style={{ flex: 1, padding: '7px 10px', background: '#1f1f23', border: '1px solid #2a2a2f', borderRadius: 5, color: '#f0f0f2', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none' }}
                                        onFocus={e => e.target.style.borderColor = '#5b5fc7'} onBlur={e => e.target.style.borderColor = '#2a2a2f'} />
                                    <IconButton onClick={sendMessage} disabled={!message.trim()} sx={{ color: message.trim() ? '#5b5fc7' : '#35353c' }}><SendIcon /></IconButton>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* ── Emoji picker ── */}
            {showEmojiPicker && (
                <div className={styles.emojiPicker}>
                    {EMOJIS.map(({ emoji, label }) => (
                        <Tooltip key={emoji} title={label} arrow placement="top">
                            <button className={styles.emojiBtn} onClick={() => sendReaction(emoji)}>{emoji}</button>
                        </Tooltip>
                    ))}
                </div>
            )}

            {/* ── Action bar ── */}
            <div className={`${styles.actionBar} ${showBar ? styles.barVisible : styles.barHidden}`}>
                <div className={styles.barLeft}>
                    <span className={styles.meetingTimer}>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className={styles.participantCount}>{totalTiles} in call</span>
                </div>
                <div className={styles.barCenter}>
                    <Tooltip title={audio ? 'Mute' : 'Unmute'} arrow>
                        <button className={`${styles.ctrlBtn} ${!audio ? styles.ctrlBtnOff : ''}`} onClick={handleAudio}>
                            {audio ? <MicIcon /> : <MicOffIcon />}<span>{audio ? 'Mute' : 'Unmuted'}</span>
                        </button>
                    </Tooltip>
                    <Tooltip title={video ? 'Stop video' : 'Start video'} arrow>
                        <button className={`${styles.ctrlBtn} ${!video ? styles.ctrlBtnOff : ''}`} onClick={handleVideo}>
                            {video ? <VideocamIcon /> : <VideocamOffIcon />}<span>Video</span>
                        </button>
                    </Tooltip>
                    <button className={styles.endBtn} onClick={handleEndCall}><CallEndIcon /><span>End</span></button>
                    {screenAvailable && (
                        <Tooltip title={screen ? 'Stop sharing' : 'Share screen'} arrow>
                            <button className={`${styles.ctrlBtn} ${screen ? styles.ctrlBtnActive : ''}`} onClick={handleScreen}>
                                {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}<span>Share</span>
                            </button>
                        </Tooltip>
                    )}
                    <Tooltip title={recording ? 'Stop recording' : 'Record'} arrow>
                        <button className={`${styles.ctrlBtn} ${recording ? styles.ctrlBtnRec : ''}`} onClick={recording ? stopRecording : startRecording}>
                            {recording ? <StopIcon /> : <FiberManualRecordIcon />}<span>{recording ? 'Stop' : 'Rec'}</span>
                        </button>
                    </Tooltip>
                    <Tooltip title="Reactions" arrow>
                        <button className={`${styles.ctrlBtn} ${showEmojiPicker ? styles.ctrlBtnActive : ''}`} onClick={() => setShowEmojiPicker(p => !p)}>
                            <TagFacesIcon /><span>React</span>
                        </button>
                    </Tooltip>
                    <Tooltip title="Participants" arrow>
                        <button className={`${styles.ctrlBtn} ${showParticipants ? styles.ctrlBtnActive : ''}`}
                            onClick={() => { setShowParticipants(p => !p); setShowChat(false); }}>
                            <Badge badgeContent={waitingList.length || null} color="warning"><PeopleIcon /></Badge>
                            <span>People</span>
                        </button>
                    </Tooltip>
                    <Tooltip title="Chat" arrow>
                        <button className={`${styles.ctrlBtn} ${showChat ? styles.ctrlBtnActive : ''}`}
                            onClick={() => { setShowChat(p => !p); setShowParticipants(false); if (!showChat) openChat(); }}>
                            <Badge badgeContent={newMessages} color="error" max={99}><ChatIcon /></Badge>
                            <span>Chat</span>
                        </button>
                    </Tooltip>
                    <Tooltip title="Invite" arrow>
                        <button className={styles.ctrlBtn} onClick={() => setShowInvite(true)}><LinkIcon /><span>Invite</span></button>
                    </Tooltip>
                </div>
                <div className={styles.barRight} />
            </div>

            {/* ── Invite modal ── */}
            {showInvite && (
                <div className={styles.modalOverlay} onClick={() => setShowInvite(false)}>
                    <div className={styles.inviteModal} onClick={e => e.stopPropagation()}>
                        <div className={styles.inviteModalHeader}><h3>Invite participants</h3><IconButton size="small" onClick={() => setShowInvite(false)} sx={{ color: '#55555f' }}><CloseIcon fontSize="small" /></IconButton></div>
                        <p className={styles.inviteSubtitle}>Share this link — the host will admit each participant</p>
                        <div className={styles.inviteUrlBox}>
                            <span className={styles.inviteUrl}>{window.location.href}</span>
                            <button className={styles.inviteCopyBtn} onClick={handleInviteCopy}><ContentCopyIcon style={{ fontSize: 14 }} />{inviteCopied ? 'Copied!' : 'Copy'}</button>
                        </div>
                        <div className={styles.inviteQrSection}>
                            <div className={styles.inviteQrLabel}>Or scan QR code</div>
                            <div className={styles.inviteQrWrap}><SimpleQR text={window.location.href} /></div>
                            <p className={styles.inviteQrHint}>Point phone camera to join on mobile</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}