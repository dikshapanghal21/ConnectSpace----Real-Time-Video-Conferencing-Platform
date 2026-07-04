import { jest } from "@jest/globals";
import mongoose from "mongoose";
import request from "supertest";
import { MongoMemoryServer } from "mongodb-memory-server";
import app from "../app.js";
import { User } from "../models/user.model.js";

let mongod;

beforeAll(async () => {
    // Tests need a JWT_SECRET; use a throwaway one so this suite never
    // depends on (or risks leaking) real secrets from .env.
    process.env.JWT_SECRET = "test_secret_do_not_use_in_prod";

    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
});

afterEach(async () => {
    await User.deleteMany({});
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

describe("POST /api/v1/users/register", () => {
    it("creates a new user with a hashed password", async () => {
        const res = await request(app)
            .post("/api/v1/users/register")
            .send({ name: "Ada Lovelace", username: "ada", password: "secretpw" });

        expect(res.status).toBe(201);

        const stored = await User.findOne({ username: "ada" });
        expect(stored).not.toBeNull();
        expect(stored.password).not.toBe("secretpw"); // must be hashed, not plaintext
    });

    it("rejects a duplicate username", async () => {
        await request(app)
            .post("/api/v1/users/register")
            .send({ name: "Ada Lovelace", username: "ada", password: "secretpw" });

        const res = await request(app)
            .post("/api/v1/users/register")
            .send({ name: "Someone Else", username: "ada", password: "otherpw" });

        expect(res.status).toBe(409);
    });

    it("rejects a password shorter than 6 characters", async () => {
        const res = await request(app)
            .post("/api/v1/users/register")
            .send({ name: "Ada Lovelace", username: "ada", password: "abc" });

        expect(res.status).toBe(400);
    });

    it("rejects missing fields", async () => {
        const res = await request(app)
            .post("/api/v1/users/register")
            .send({ username: "ada" });

        expect(res.status).toBe(400);
    });
});

describe("POST /api/v1/users/login", () => {
    beforeEach(async () => {
        await request(app)
            .post("/api/v1/users/register")
            .send({ name: "Ada Lovelace", username: "ada", password: "secretpw" });
    });

    it("logs in with correct credentials and returns a JWT", async () => {
        const res = await request(app)
            .post("/api/v1/users/login")
            .send({ username: "ada", password: "secretpw" });

        expect(res.status).toBe(200);
        expect(typeof res.body.token).toBe("string");
        expect(res.body.token.split(".")).toHaveLength(3); // header.payload.signature
    });

    it("rejects an incorrect password", async () => {
        const res = await request(app)
            .post("/api/v1/users/login")
            .send({ username: "ada", password: "wrongpw" });

        expect(res.status).toBe(401);
    });

    it("rejects a nonexistent user", async () => {
        const res = await request(app)
            .post("/api/v1/users/login")
            .send({ username: "nobody", password: "whatever" });

        expect(res.status).toBe(404);
    });
});

describe("GET /api/v1/users/get_all_activity (protected route)", () => {
    it("rejects requests with no token", async () => {
        const res = await request(app).get("/api/v1/users/get_all_activity");
        expect(res.status).toBe(401);
    });

    it("rejects requests with a malformed token", async () => {
        const res = await request(app)
            .get("/api/v1/users/get_all_activity")
            .set("Authorization", "Bearer not-a-real-token");
        expect(res.status).toBe(401);
    });

    it("accepts requests with a valid token from login", async () => {
        await request(app)
            .post("/api/v1/users/register")
            .send({ name: "Ada Lovelace", username: "ada", password: "secretpw" });

        const loginRes = await request(app)
            .post("/api/v1/users/login")
            .send({ username: "ada", password: "secretpw" });

        const res = await request(app)
            .get("/api/v1/users/get_all_activity")
            .set("Authorization", `Bearer ${loginRes.body.token}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
    });
});

describe("DELETE /api/v1/users/clear_activity (protected route)", () => {
    it("rejects requests with no token", async () => {
        const res = await request(app).delete("/api/v1/users/clear_activity");
        expect(res.status).toBe(401);
    });

    it("clears all history for the logged-in user only", async () => {
        // Ada logs in and adds a meeting
        await request(app).post("/api/v1/users/register").send({ name: "Ada Lovelace", username: "ada", password: "secretpw" });
        const adaLogin = await request(app).post("/api/v1/users/login").send({ username: "ada", password: "secretpw" });
        await request(app).post("/api/v1/users/add_to_activity")
            .set("Authorization", `Bearer ${adaLogin.body.token}`)
            .send({ meeting_code: "ada-meeting-1" });

        // Grace logs in and adds a meeting — should be unaffected by Ada's clear
        await request(app).post("/api/v1/users/register").send({ name: "Grace Hopper", username: "grace", password: "secretpw" });
        const graceLogin = await request(app).post("/api/v1/users/login").send({ username: "grace", password: "secretpw" });
        await request(app).post("/api/v1/users/add_to_activity")
            .set("Authorization", `Bearer ${graceLogin.body.token}`)
            .send({ meeting_code: "grace-meeting-1" });

        const clearRes = await request(app).delete("/api/v1/users/clear_activity")
            .set("Authorization", `Bearer ${adaLogin.body.token}`);
        expect(clearRes.status).toBe(200);

        const adaHistory = await request(app).get("/api/v1/users/get_all_activity")
            .set("Authorization", `Bearer ${adaLogin.body.token}`);
        expect(adaHistory.body).toEqual([]);

        const graceHistory = await request(app).get("/api/v1/users/get_all_activity")
            .set("Authorization", `Bearer ${graceLogin.body.token}`);
        expect(graceHistory.body).toHaveLength(1);
    });
});