<div align="center">
  <h1>🎥 ConnectSpace</h1>
  <p><strong>Real-Time Video Conferencing Platform — MERN + WebRTC</strong></p>
  <p>Host or join a video call in seconds.<br/>Waiting-room admission · Zoom-style screen share spotlight · Live reactions · In-call chat</p>

  <img src="https://img.shields.io/badge/Stack-MERN-orange?style=flat-square" />
  <img src="https://img.shields.io/badge/Realtime-WebRTC_%2B_Socket.IO-black?style=flat-square" />
  <img src="https://img.shields.io/badge/Auth-JWT_%2B_bcrypt-blue?style=flat-square" />
  <img src="https://img.shields.io/badge/Tests-Jest_%2B_Supertest-green?style=flat-square" />
  <img src="https://img.shields.io/badge/Deploy-Render_%2B_Vercel-purple?style=flat-square" />
</div>

---

## 🚀 Features

- 🚪 **Meeting Lobby** — camera/mic preview and device checks before joining
- 🧑‍🤝‍🧑 **Waiting Room** — host approves or denies each participant before they're admitted
- 🖥️ **Zoom-style Screen Share Spotlight** — shared screen takes over the main stage, everyone else moves to a thumbnail strip, no recursive "hall of mirrors" self-preview
- 😀 **Live Reactions** — emoji reactions float from the top-right corner of whoever sent them, visible for 10 seconds
- 💬 **In-call Chat** — real-time text chat alongside the call
- 📷 **Camera On/Off Sync** — toggling your camera is reflected live on everyone else's view, not just your own
- 🔴 **Call Recording** — record the meeting locally from the browser
- 🔗 **Invite Link + QR Code** — one-click copy or scan to invite
- 📜 **Meeting History** — see your past meetings, rejoin with one click (no retyping your name), or clear your history entirely
- 🔐 **JWT Auth** — bcrypt-hashed passwords, protected routes, auto-logout on expired token
- 🛡️ **Rate-Limited & Locked-Down CORS** — origin allowlist instead of a wildcard, per-user/IP request limits

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, Material UI v5, React Router v6, WebRTC, Socket.IO Client |
| **Backend** | Node.js, Express, Socket.IO, MongoDB + Mongoose, JWT, bcrypt |
| **Real-time** | WebRTC (mesh P2P) with ICE/STUN signaling relayed over Socket.IO |
| **Testing** | Jest, Supertest, mongodb-memory-server |
| **Deploy** | Vercel (frontend) + Render (backend) + MongoDB Atlas |

---

## 📁 Project Structure

```
ZoomClone/
├── backend/
│   ├── src/
│   │   ├── app.js                    # Express app (routes/middleware only, testable)
│   │   ├── server.js                 # Bootstrap: DB connect, HTTP listen, Socket.IO, graceful shutdown
│   │   ├── controllers/
│   │   │   ├── socketManager.js      # WebRTC signaling + all real-time events
│   │   │   └── user.controller.js    # Auth + history controllers
│   │   ├── models/
│   │   │   ├── user.model.js
│   │   │   └── meeting.model.js
│   │   ├── routes/
│   │   │   └── users.routes.js
│   │   ├── middleware/
│   │   │   └── authMiddleware.js     # JWT verification
│   │   └── __tests__/
│   │       └── auth.test.js          # Register/login/history test suite
│   ├── .env.example
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── VideoMeet.jsx         # Full meeting room — lobby, grid, spotlight, chat
    │   │   ├── landing.jsx           # Hero landing page
    │   │   ├── authentication.jsx    # Login / signup
    │   │   ├── home.jsx              # Create / join meeting
    │   │   └── history.jsx           # Meeting history + rejoin + clear
    │   ├── contexts/AuthContext.jsx
    │   ├── styles/videoComponent.module.css
    │   ├── environment.js            # Single source of truth for the backend URL
    │   ├── App.js                    # Routes + MUI dark theme
    │   └── App.css
    ├── .env.example
    └── package.json
```

---

## ⚙️ Local Setup

### 1. Clone & install

```bash
git clone <your-repo-url>
cd ZoomClone

cd backend && npm install
cd ../frontend && npm install
```

### 2. Configure environment

**`backend/.env`** (copy from `backend/.env.example`)
```env
PORT=8000
FRONTEND_URL=http://localhost:3000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/?appName=Cluster0
JWT_SECRET=any_long_random_string_you_make_up
```

**`frontend/.env`** (copy from `frontend/.env.example`)
```env
REACT_APP_SERVER_URL=http://localhost:8000
```

### 3. Run

```bash
# Terminal 1
cd backend && npm run dev
# ✓ Runs on http://localhost:8000

# Terminal 2
cd frontend && npm start
# ✓ Opens at http://localhost:3000
```

### 4. Run tests
```bash
cd backend && npm test
```

---

## 🌐 Deployment

Before deploying anywhere: rotate any credentials that were ever shared or committed. See the security note at the top of `backend/.env`.

### Backend → Render (free tier)

1. New **Web Service** on [render.com](https://render.com), connect your GitHub repo
2. Root directory: `backend` · Build: `npm install` · Start: `npm start`
3. Set environment variables (see `backend/.env.example`):
   - `MONGO_URI`, `JWT_SECRET`, `PORT`
   - `FRONTEND_URL` — your deployed frontend URL, no trailing slash. CORS and Socket.IO both reject any origin not listed here.
4. Deploy — note the resulting backend URL (e.g. `https://your-app.onrender.com`)

### Frontend → Vercel

1. Push to GitHub, import on [vercel.com](https://vercel.com)
2. Root directory: `frontend`
3. Set environment variable:
   ```
   REACT_APP_SERVER_URL=https://your-backend.onrender.com
   ```
4. Deploy — `frontend/src/environment.js` reads this automatically, no source edits needed

### Close the loop

Go back to the backend's env vars on Render and set `FRONTEND_URL` to the Vercel URL from the step above, then redeploy the backend so CORS allows it.

---

## 📱 All Routes

| Route | Page | Auth Required |
|---|---|---|
| `/` | Landing page | No |
| `/auth` | Login / Signup | No |
| `/home` | Create or join a meeting | ✅ Yes |
| `/history` | Meeting history, rejoin, clear history | ✅ Yes |
| `/:meetingCode` | The meeting room itself (guests can join via link, no login required) | No |

---

## 🔴 Socket.IO Events

```javascript
// Joining & admission
socket.emit('join-call', meetingUrl, username)
socket.on('waiting-for-admission')          // you're in the waiting room
socket.on('admission-granted')              // host let you in
socket.on('admission-denied')               // host declined you
socket.emit('admit-user', path, waitingSocketId)   // host admits someone
socket.emit('deny-user', path, waitingSocketId)    // host declines someone
socket.on('waiting-list-update', (list) => {})     // host sees who's waiting
socket.on('user-joined', (id, clients) => {})
socket.on('user-left', (id) => {})
socket.on('room-full', ({ max }) => {})            // mesh call at capacity (8 participants)
socket.on('room-closed')                            // host ended the meeting
socket.on('server-shutdown')                        // backend restarting/deploying

// WebRTC signaling (offer/answer/ICE relay — media itself is P2P)
socket.emit('signal', toSocketId, JSON.stringify({ sdp / ice }))
socket.on('signal', (fromId, message) => {})

// In-call features
socket.emit('announce-name', username)
socket.on('peer-name', (socketId, name) => {})
socket.emit('chat-message', path, message)
socket.on('chat-message', ({ sender, data }) => {})
socket.emit('reaction', emoji, sender)
socket.on('reaction', (emoji, sender, fromSocketId) => {})
socket.emit('screen-share-status', isSharing)
socket.on('screen-share-status', (fromSocketId, isSharing) => {})
socket.emit('video-status', isCameraOn)
socket.on('video-status', (fromSocketId, isCameraOn) => {})
```

---

## 🧠 WebRTC Architecture (for interviews)

```
Peer A  ──[offer/answer/ICE]──▶  Socket.IO Server  ──[relay]──▶  Peer B
        ◀────────────────────────────────────────────────────────
                   (signaling only — media streams are P2P)
```

**Key interview talking points:**
- Mesh topology: every peer connects to every other peer directly — capped at 8 participants per room (`MAX_PARTICIPANTS_PER_ROOM` in `socketManager.js`) since mesh bandwidth/CPU cost grows O(n²)
- STUN server (Google's free `stun.l.google.com`) resolves NAT traversal
- Socket.IO rooms manage which peers are in the same call
- Limitation: mesh doesn't scale past ~8 peers → the standard fix is an SFU (e.g. mediasoup, LiveKit)
- Known tradeoff: screen sharing replaces your camera track rather than sending both simultaneously — real picture-in-picture (camera + screen at once) needs a second video track per peer, a bigger signaling change

---

## 🔮 Future Enhancements

### 🖥️ SFU Architecture
- Swap the mesh topology for an SFU (mediasoup/LiveKit) to scale past 8 participants
- Simulcast so each viewer gets a resolution matched to their bandwidth

### 📹 Simultaneous Camera + Screen Share
- Send a second video track per peer so presenters keep their camera visible (like real Zoom's picture-in-picture) instead of the screen replacing it

### 💾 Persistent Call State
- Back the in-memory signaling state (`socketManager.js`) with Redis so active calls survive a server restart, and support multiple backend instances behind a load balancer

### 🔔 Notifications
- Email a meeting invite/summary via a transactional email provider
- Browser push notification when you're admitted from the waiting room

### 📊 Admin/Analytics
- Meeting duration and participant-count analytics per user
- Basic admin view of usage across accounts

### 🔐 Further Security Hardening
- Two-factor authentication (2FA) via OTP
- Refresh-token rotation instead of a single long-lived JWT
- Signed, expiring invite links instead of a static meeting code