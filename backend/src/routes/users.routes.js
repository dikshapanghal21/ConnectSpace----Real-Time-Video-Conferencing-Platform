import { Router } from "express";
import { addToHistory, clearHistory, getUserHistory, login, register } from "../controllers/user.controller.js";
import { verifyToken } from "../middleware/authMiddleware.js";

const router = Router();

// Public routes — no auth required
router.post("/login",    login);
router.post("/register", register);

// Protected routes — JWT required in Authorization header
router.get(   "/get_all_activity",  verifyToken, getUserHistory);
router.post(  "/add_to_activity",   verifyToken, addToHistory);
router.delete("/clear_activity",    verifyToken, clearHistory);

export default router;