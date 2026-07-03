import jwt from "jsonwebtoken";

// ── Middleware: verify JWT from Authorization header ──
// Usage: router.get("/route", verifyToken, controller)
// Frontend must send: Authorization: Bearer <token>

export const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    const token = authHeader.split(" ")[1];

    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) throw new Error("JWT_SECRET not configured");

        const decoded = jwt.verify(token, secret);
        req.user = decoded; // { userId, username, name, iat, exp }
        next();

    } catch (err) {
        if (err.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Session expired. Please sign in again." });
        }
        return res.status(401).json({ message: "Invalid token." });
    }
};