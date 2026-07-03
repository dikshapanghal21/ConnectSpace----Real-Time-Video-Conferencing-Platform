import axios      from "axios";
import httpStatus from "http-status";
import { createContext, useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import server from "../environment";

export const AuthContext = createContext({});

const client = axios.create({
    baseURL: `${server}/api/v1/users`
});

// ── Attach JWT to every request automatically ──
client.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
});

// ── If backend returns 401 (expired/invalid token), auto sign out ──
client.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem("token");
            window.location.href = "/auth";
        }
        return Promise.reject(error);
    }
);

export const AuthProvider = ({ children }) => {
    const authContext = useContext(AuthContext);
    const [userData, setUserData] = useState(authContext);
    const navigate = useNavigate();

    const handleRegister = async (name, username, password) => {
        try {
            const res = await client.post("/register", { name, username, password });
            if (res.status === httpStatus.CREATED) {
                return res.data.message;
            }
        } catch (err) {
            throw err;
        }
    };

    const handleLogin = async (username, password) => {
        try {
            const res = await client.post("/login", { username, password });
            if (res.status === httpStatus.OK) {
                // Store JWT in localStorage
                localStorage.setItem("token", res.data.token);
                navigate("/home");
            }
        } catch (err) {
            throw err;
        }
    };

    // Token is sent automatically via the axios interceptor above
    const getHistoryOfUser = async () => {
        try {
            const res = await client.get("/get_all_activity");
            return res.data;
        } catch (err) {
            throw err;
        }
    };

    const addToUserHistory = async (meetingCode) => {
        try {
            const res = await client.post("/add_to_activity", { meeting_code: meetingCode });
            return res;
        } catch (err) {
            throw err;
        }
    };

    const data = { userData, setUserData, addToUserHistory, getHistoryOfUser, handleRegister, handleLogin };

    return (
        <AuthContext.Provider value={data}>
            {children}
        </AuthContext.Provider>
    );
};