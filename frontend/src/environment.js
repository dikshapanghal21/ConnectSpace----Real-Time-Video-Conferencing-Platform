// Reads the backend URL from the build-time env var so deploys only ever
// require setting REACT_APP_SERVER_URL (in .env locally, or in your
// hosting provider's environment variables panel) — no source edits, no
// rebuild-and-hope. Falls back to localhost for local dev if unset.
const server = process.env.REACT_APP_SERVER_URL || "https://connect-space-real-time-video-confe.vercel.app";

export default server;
