import express from "express";
import cors from "cors";
import userRoutes from "./routes/users.routes.js";

// ── Pure Express app: routes + middleware only. No DB connection, no
//    HTTP listener, no Socket.IO wiring here on purpose — that lets tests
//    (see __tests__/) import this app and hit it with Supertest against
//    an isolated in-memory database, without booting a real server or
//    touching the real MongoDB instance. Actual process bootstrap lives
//    in server.js. ──
const app = express();

// FRONTEND_URL should be set to your deployed frontend origin(s) in
// production (comma-separated if you have more than one, e.g. a Vercel
// preview + production URL). Falls back to common local dev ports when
// unset so `npm run dev` keeps working out of the box.
const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:3000")
    .split(",")
    .map(o => o.trim());

const corsOptions = {
    origin: (origin, callback) => {
        // Allow non-browser tools (curl, server-to-server, health checks)
        // that don't send an Origin header at all.
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error(`CORS: origin ${origin} not allowed`));
        }
    },
    credentials: true
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "5mb" }));   // increased for transcript payloads
app.use(express.urlencoded({ limit: "5mb", extended: true }));

app.use("/api/v1/users", userRoutes);

export default app;
