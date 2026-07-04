import { Server } from "socket.io"

// Full-mesh WebRTC means every participant opens a direct connection to
// every other participant — bandwidth/CPU cost grows O(n^2). Past ~8
// people this degrades badly, so we cap room size instead of letting
// quality silently fall apart. (Scaling further requires an SFU like
// mediasoup, which is a separate architecture change, not a config knob.)
const MAX_PARTICIPANTS_PER_ROOM = 8;

let connections = {}   // path → [socketId, ...]
let messages    = {}   // path → [{sender, data, socket-id-sender}]
let timeOnline  = {}   // socketId → Date
let roomHosts   = {}   // path → hostSocketId  (first joiner = host)
let roomClosed  = {}   // path → true  (host ended the meeting)
let waitingList = {}   // path → [{socketId, username}]
let socketNames = {}   // socketId → username

// ── In-memory state note ──
// connections/messages/waitingList etc. live only in process memory, so a
// server restart drops every active call and chat history — there's no
// external store (Redis/DB) backing this. Fixing that fully is a bigger
// architecture change (sticky sessions + shared state store) that's out of
// scope for a single-instance deployment. What we *can* do cheaply is make
// restarts less jarring: warn connected clients before the process exits
// instead of just dropping their sockets.
let shuttingDown = false;

export const notifyShutdown = (io) => {
    shuttingDown = true;
    io.emit("server-shutdown");
    console.log(`Notified ${io.engine.clientsCount} client(s) of server shutdown`);
};

// Helper: find which room a socket is in
const findRoom = (socketId) => {
    for (const [path, members] of Object.entries(connections)) {
        if (members.includes(socketId)) return path;
    }
    return null;
};

export const connectToSocket = (server) => {
    // Same allowlist logic as app.js — kept in sync via the same env var
    // so you only ever set FRONTEND_URL in one place.
    const allowedOrigins = (process.env.FRONTEND_URL || "https://connect-space-real-time-video-confe.vercel.app")
        .split(",")
        .map(o => o.trim());

    const io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    io.on("connection", (socket) => {
        console.log("CONNECTED:", socket.id);

        // ── Let a newly-connected client know if the server was already
        //    mid-shutdown when they connected (edge case during deploys) ──
        if (shuttingDown) {
            socket.emit("server-shutdown");
        }

        // ── Join call ──
        socket.on("join-call", (path, username) => {
            socketNames[socket.id] = username || "Guest";

            // ── Feature 5: room closed? reject immediately ──
            if (roomClosed[path]) {
                socket.emit("room-closed");
                return;
            }

            // ── Room at capacity? reject before adding to waiting list ──
            const currentSize = connections[path] ? connections[path].length : 0;
            if (currentSize >= MAX_PARTICIPANTS_PER_ROOM) {
                socket.emit("room-full", { max: MAX_PARTICIPANTS_PER_ROOM });
                return;
            }

            // ── Feature 4: if room exists and has a host, go to waiting ──
            if (connections[path] && connections[path].length > 0) {
                // Put in waiting list
                if (!waitingList[path]) waitingList[path] = [];
                waitingList[path].push({ socketId: socket.id, username: socketNames[socket.id] });

                // Notify host about new waiting user
                const hostId = roomHosts[path];
                if (hostId) {
                    io.to(hostId).emit("admission-request", {
                        socketId: socket.id,
                        username: socketNames[socket.id]
                    });
                }

                // Tell requester they're in the waiting room
                socket.emit("waiting-for-admission");

                // Send updated waiting list to host
                io.to(hostId).emit("waiting-list-update", waitingList[path]);
                return;
            }

            // ── First joiner = host ──
            if (!connections[path]) connections[path] = [];
            roomHosts[path] = socket.id;

            admitUser(socket.id, path, io);
        });

        // ── Host admits a waiting user ──
        socket.on("admit-user", (path, waitingSocketId) => {
            if (!waitingList[path]) return;
            const idx = waitingList[path].findIndex(u => u.socketId === waitingSocketId);
            if (idx === -1) return;

            // Guard against a race where the room filled up while this
            // user was waiting (e.g. host admits several people at once).
            const currentSize = connections[path] ? connections[path].length : 0;
            if (currentSize >= MAX_PARTICIPANTS_PER_ROOM) {
                io.to(waitingSocketId).emit("room-full", { max: MAX_PARTICIPANTS_PER_ROOM });
                return;
            }

            waitingList[path].splice(idx, 1);

            admitUser(waitingSocketId, path, io);

            // Update waiting list for host
            io.to(socket.id).emit("waiting-list-update", waitingList[path] || []);
        });

        // ── Host denies a waiting user ──
        socket.on("deny-user", (path, waitingSocketId) => {
            if (!waitingList[path]) return;
            waitingList[path] = waitingList[path].filter(u => u.socketId !== waitingSocketId);
            io.to(waitingSocketId).emit("admission-denied");
            io.to(socket.id).emit("waiting-list-update", waitingList[path]);
        });

        // ── Host closes the room ──
        socket.on("close-room", (path) => {
            if (roomHosts[path] !== socket.id) return;
            roomClosed[path] = true;

            // Kick everyone in the room
            if (connections[path]) {
                connections[path].forEach(id => {
                    if (id !== socket.id) io.to(id).emit("room-closed");
                });
            }
            // Reject all waiting users
            if (waitingList[path]) {
                waitingList[path].forEach(u => io.to(u.socketId).emit("room-closed"));
                waitingList[path] = [];
            }

            console.log("Room closed:", path);
        });

        // ── Broadcast username so others know the name ──
        socket.on("announce-name", (username) => {
            socketNames[socket.id] = username;
            const path = findRoom(socket.id);
            if (path) {
                connections[path].forEach(id => {
                    if (id !== socket.id) {
                        io.to(id).emit("peer-name", socket.id, username);
                    }
                });
            }
        });

        // ── Signals ──
        socket.on("signal", (toId, message) => {
            io.to(toId).emit("signal", socket.id, message);
        });

        // ── Chat ──
        socket.on("chat-message", (data, sender) => {
            const path = findRoom(socket.id);
            if (!path) return;
            if (!messages[path]) messages[path] = [];
            messages[path].push({ sender, data, "socket-id-sender": socket.id });
            connections[path].forEach(id => {
                io.to(id).emit("chat-message", data, sender, socket.id);
            });
        });

        // ── Screen share status relay — lets everyone in the room know
        //    who's presenting so the frontend can spotlight that tile. ──
        socket.on("screen-share-status", (sharing) => {
            const path = findRoom(socket.id);
            if (!path) return;
            connections[path].forEach(id => {
                if (id !== socket.id) io.to(id).emit("screen-share-status", socket.id, sharing);
            });
        });

        // ── Camera on/off relay — lets everyone know when a participant
        //    toggles their camera, so their tile can show a "camera off"
        //    placeholder instead of a frozen/black video frame. ──
        socket.on("video-status", (isOn) => {
            const path = findRoom(socket.id);
            if (!path) return;
            connections[path].forEach(id => {
                if (id !== socket.id) io.to(id).emit("video-status", socket.id, isOn);
            });
        });

        // ── Reaction relay ──
        socket.on("reaction", (emoji, sender) => {
            const path = findRoom(socket.id);
            if (!path) return;
            connections[path].forEach(id => {
                if (id !== socket.id) io.to(id).emit("reaction", emoji, sender, socket.id);
            });
        });

        // ── Disconnect ──
        socket.on("disconnect", () => {
            const path = findRoom(socket.id);
            if (path) {
                // Notify everyone in the room
                connections[path].forEach(id => {
                    io.to(id).emit("user-left", socket.id);
                });
                connections[path] = connections[path].filter(id => id !== socket.id);

                // If host left, close the room
                if (roomHosts[path] === socket.id) {
                    roomClosed[path] = true;
                    connections[path].forEach(id => io.to(id).emit("room-closed"));
                    if (waitingList[path]) {
                        waitingList[path].forEach(u => io.to(u.socketId).emit("room-closed"));
                    }
                }

                if (connections[path].length === 0) {
                    delete connections[path];
                    delete roomHosts[path];
                    delete waitingList[path];
                    // Keep roomClosed so late joiners still get rejected
                }
            }

            // Also remove from waiting list
            for (const path in waitingList) {
                const before = waitingList[path].length;
                waitingList[path] = waitingList[path].filter(u => u.socketId !== socket.id);
                if (waitingList[path].length !== before && roomHosts[path]) {
                    io.to(roomHosts[path]).emit("waiting-list-update", waitingList[path]);
                }
            }

            delete socketNames[socket.id];
            delete timeOnline[socket.id];
        });
    });

    return io;
};

// ── Helper: actually admit a user into the room ──
function admitUser(socketId, path, io) {
    if (!connections[path]) connections[path] = [];
    connections[path].push(socketId);
    timeOnline[socketId] = new Date();

    // Tell the admitted user they're in
    io.to(socketId).emit("admission-granted");

    // Send them existing chat messages
    if (messages[path]) {
        messages[path].forEach(m => {
            io.to(socketId).emit("chat-message", m.data, m.sender, m["socket-id-sender"]);
        });
    }

    // Notify everyone (including the new user) that someone joined
    connections[path].forEach(id => {
        io.to(id).emit("user-joined", socketId, connections[path]);
    });

    // Send the admitted user the current participant names
    connections[path].forEach(id => {
        if (id !== socketId && socketNames[id]) {
            io.to(socketId).emit("peer-name", id, socketNames[id]);
        }
    });

    // Announce the new user's name to everyone
    if (socketNames[socketId]) {
        connections[path].forEach(id => {
            if (id !== socketId) {
                io.to(id).emit("peer-name", socketId, socketNames[socketId]);
            }
        });
    }

    console.log(`Admitted ${socketId} (${socketNames[socketId]}) to ${path}`);
}