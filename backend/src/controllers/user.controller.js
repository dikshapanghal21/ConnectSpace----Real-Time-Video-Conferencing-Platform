import httpStatus from "http-status";
import { User }    from "../models/user.model.js";
import { Meeting } from "../models/meeting.model.js";
import bcrypt      from "bcrypt";
import jwt         from "jsonwebtoken";

// ── Helper: get JWT secret from env (fails loudly if missing) ──
const getSecret = () => {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error("JWT_SECRET is not set in .env");
    return secret;
};

// ─────────────────────────────────────────────
//  POST /api/v1/users/login
// ─────────────────────────────────────────────
const login = async (req, res) => {
    const { username, password } = req.body;

    if (!username?.trim() || !password?.trim()) {
        return res.status(400).json({ message: "Username and password are required" });
    }

    try {
        const user = await User.findOne({ username: username.trim() });
        if (!user) {
            return res.status(httpStatus.NOT_FOUND).json({ message: "User not found" });
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) {
            return res.status(httpStatus.UNAUTHORIZED).json({ message: "Invalid username or password" });
        }

        // Sign a JWT — payload contains user identity, expires in 7 days
        const token = jwt.sign(
            { userId: user._id, username: user.username, name: user.name },
            getSecret(),
            { expiresIn: "7d" }
        );

        return res.status(httpStatus.OK).json({ token });

    } catch (e) {
        console.error("Login error:", e.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────
//  POST /api/v1/users/register
// ─────────────────────────────────────────────
const register = async (req, res) => {
    const { name, username, password } = req.body;

    if (!name?.trim() || !username?.trim() || !password?.trim()) {
        return res.status(400).json({ message: "Name, username, and password are required" });
    }
    if (username.trim().length < 3) {
        return res.status(400).json({ message: "Username must be at least 3 characters" });
    }
    if (password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    try {
        const existingUser = await User.findOne({ username: username.trim() });
        if (existingUser) {
            return res.status(httpStatus.CONFLICT).json({ message: "Username already taken" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = new User({
            name:     name.trim(),
            username: username.trim(),
            password: hashedPassword,
        });

        await newUser.save();
        return res.status(httpStatus.CREATED).json({ message: "User registered successfully" });

    } catch (e) {
        console.error("Register error:", e.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────
//  GET /api/v1/users/get_all_activity
//  Protected — requires verifyToken middleware
// ─────────────────────────────────────────────
const getUserHistory = async (req, res) => {
    // req.user is set by verifyToken middleware
    try {
        const meetings = await Meeting.find({ user_id: req.user.username }).sort({ date: -1 });
        return res.json(meetings);
    } catch (e) {
        console.error("Get history error:", e.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// ─────────────────────────────────────────────
//  POST /api/v1/users/add_to_activity
//  Protected — requires verifyToken middleware
// ─────────────────────────────────────────────
const addToHistory = async (req, res) => {
    const { meeting_code } = req.body;

    if (!meeting_code?.trim()) {
        return res.status(400).json({ message: "Meeting code is required" });
    }

    try {
        // Avoid duplicate entries for the same meeting code + user
        const existing = await Meeting.findOne({
            user_id:     req.user.username,
            meetingCode: meeting_code.trim()
        });

        if (!existing) {
            await Meeting.create({
                user_id:     req.user.username,
                meetingCode: meeting_code.trim()
            });
        }

        return res.status(httpStatus.CREATED).json({ message: "Added to history" });
    } catch (e) {
        console.error("Add history error:", e.message);
        return res.status(500).json({ message: "Internal server error" });
    }
};

export { login, register, getUserHistory, addToHistory };