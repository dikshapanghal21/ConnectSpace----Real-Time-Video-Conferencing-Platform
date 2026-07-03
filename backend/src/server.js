import { createServer } from "node:http";
import mongoose from "mongoose";
import dotenv from "dotenv";
import app from "./app.js";
import { connectToSocket, notifyShutdown } from "./controllers/socketManager.js";

dotenv.config();

const server = createServer(app);
const io = connectToSocket(server);

const PORT = process.env.PORT || 8000;

const start = async () => {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) { console.error("ERROR: MONGO_URI not set in .env"); process.exit(1); }
    const db = await mongoose.connect(mongoUri);
    console.log(`MONGO Connected: ${db.connection.host}`);
    server.listen(PORT, () => {
        console.log(`LISTENING ON PORT ${PORT}`);
    });
};

start();

// ── Graceful shutdown ──
// In-memory call/chat state (see socketManager.js) doesn't survive a
// restart. We can't prevent that without adding an external store, but we
// can at least warn connected clients so the frontend can show "server
// restarting, reconnecting..." instead of silently losing the call.
const shutdown = (signal) => {
    console.log(`${signal} received: notifying clients and shutting down`);
    notifyShutdown(io);
    server.close(() => {
        mongoose.connection.close(false).finally(() => process.exit(0));
    });
    // Force-exit if connections don't close within 5s
    setTimeout(() => process.exit(1), 5000).unref();
};

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
