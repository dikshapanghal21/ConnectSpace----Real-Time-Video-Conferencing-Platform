import mongoose, { Schema } from "mongoose";

// token field removed — JWT is stateless, nothing stored in DB
const userScheme = new Schema({
    name:     { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    password: { type: String, required: true },
}, { timestamps: true });

const User = mongoose.model("User", userScheme);
export { User };