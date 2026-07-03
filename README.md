# ConnectSpace — Real-Time Video Conferencing Platform

A full-stack Zoom-clone built with WebRTC, Socket.IO, and the MERN stack.

## Tech Stack
- **Frontend**: React 18, Material UI v5, WebRTC, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO, MongoDB (Mongoose), JWT, bcrypt
- **Real-time**: WebRTC (P2P), ICE/STUN signaling via Socket.IO

## Features Added (v2)
1. ✅ **Meeting Lobby** — camera/mic preview before joining, device status indicators
2. ✅ **Participant Tile Grid** — responsive gallery view (1×1 to 4×4) like Zoom
3. ✅ **Floating Action Bar** — auto-hides, shows on mouse move, clean controls
4. ✅ **Animated Connection States** — connecting spinner, step-by-step status
5. ✅ **Custom Dark Design System** — branded MUI theme, gradients, glassmorphism
6. ✅ **Proper Landing Page** — hero section, feature grid, stats
7. ✅ **Redesigned Auth Page** — split layout, better UX
8. ✅ **Invite Link Copy** — one-click copy in lobby + meeting
9. ✅ **Zoom-style Screen Share Spotlight** — shared screen takes over the main stage, everyone else moves to a thumbnail strip

---

## Setup & Run

### Prerequisites
- Node.js 18+
- A MongoDB Atlas account (or local MongoDB)

### 1. Clone / extract the project
```bash
cd ZoomClone
```

### 2. Configure Backend Environment
```bash
cd backend
cp .env.example .env
# Edit .env and fill in your MONGO_URI and JWT_SECRET
```

### 3. Install & run backend
```bash
cd backend
npm install
npm run dev
# ✓ Runs on http://localhost:8000
```

### 4. Install & run frontend (new terminal)
```bash
cd frontend
npm install
npm start
# ✓ Opens at http://localhost:3000
```

---

## Deployment

Before deploying anywhere: rotate any credentials that were ever shared or committed (Mongo password, JWT_SECRET). See the security note at the top of `backend/.env`.

### 1. Backend → Railway / Render (free tier)
1. Push the `backend/` folder to GitHub
2. Connect the repo to Railway.app or Render.com
3. Set environment variables (see `backend/.env.example` for the full list):
   - `MONGO_URI`, `JWT_SECRET`, `PORT`
   - `FRONTEND_URL` — your deployed frontend URL (set this *after* step 2 below, or update it once you know the final URL). CORS and Socket.IO both reject any origin not listed here.
4. Deploy — note the resulting backend URL (e.g. `https://your-app.onrender.com`)

### 2. Frontend → Vercel (free)
1. In Vercel's project settings, set the environment variable `REACT_APP_SERVER_URL` to your backend URL from step 1 (no trailing slash)
2. Deploy — Vercel runs `npm run build` automatically, which bakes `REACT_APP_SERVER_URL` into the build
3. `frontend/src/environment.js` reads this automatically; no source edits needed

### 3. Close the loop
Go back to the backend's env vars and set `FRONTEND_URL` to the Vercel URL from step 2, then redeploy the backend so CORS allows it.

### Local dev
`backend/.env` defaults `FRONTEND_URL=http://localhost:3000` and `frontend/.env` defaults `REACT_APP_SERVER_URL=http://localhost:8000` — no changes needed to run both locally.

---

## Project Structure
```
ZoomClone/
├── backend/
│   ├── src/
│   │   ├── app.js                  # Express app (routes/middleware only, testable)
│   │   ├── server.js               # Bootstrap: DB connect, HTTP listen, Socket.IO, graceful shutdown
│   │   ├── controllers/
│   │   │   ├── socketManager.js    # WebRTC signaling logic
│   │   │   └── user.controller.js  # Auth controllers
│   │   ├── models/
│   │   │   ├── user.model.js
│   │   │   └── meeting.model.js
│   │   └── routes/
│   │       └── users.routes.js
│   ├── .env                        # ← your secrets (not committed)
│   └── package.json
│
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── VideoMeet.jsx       # ★ Full meeting room (4 features added)
    │   │   ├── landing.jsx         # ★ New hero landing page
    │   │   ├── authentication.jsx  # ★ Redesigned auth
    │   │   ├── home.jsx            # ★ Upgraded home
    │   │   └── history.jsx         # ★ Upgraded history
    │   ├── contexts/AuthContext.jsx
    │   ├── styles/videoComponent.module.css  # ★ Full CSS for meeting room
    │   ├── App.js                  # MUI dark theme provider
    │   └── App.css                 # Global design system
    └── package.json
```

---

## WebRTC Architecture (for interviews)
```
Peer A  ──[offer/answer/ICE]──▶  Socket.IO Server  ──[relay]──▶  Peer B
         ◀────────────────────────────────────────────────────────
                    (signaling only — media streams are P2P)
```

**Key interview talking points:**
- Mesh topology: every peer connects to every other peer directly
- STUN server (Google's free stun.l.google.com) resolves NAT traversal
- Socket.IO rooms manage which peers are in the same call
- Limitation: mesh doesn't scale past ~6 peers → solution is SFU (mediasoup)
