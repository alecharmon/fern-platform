const express = require("express");
const cors = require("cors");
const app = express();
const port = 8080;

// Enable CORS for localhost:3000 with more permissive configuration
app.use(
    cors({
        origin: "http://localhost:3000",
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
        exposedHeaders: ["X-RateLimit-Remaining", "X-Total-Count", "Location"],
        credentials: true,
        preflightContinue: false,
        optionsSuccessStatus: 204
    })
);

// Middleware to parse JSON bodies
app.use(express.json());

// Mock data store
const users = [];
const products = [];
let requestId = 1;

// Helper function to generate error response
const errorResponse = (res, status, error, code, details = null) => {
    const response = { error, code };
    if (details) {
        response.details = details;
    }
    res.status(status).json(response);
};

// Users endpoints
app.get("/users", (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    res.setHeader("X-RateLimit-Remaining", "99");
    res.setHeader("X-Total-Count", users.length.toString());

    res.json({
        users: users.slice((page - 1) * limit, page * limit),
        pagination: {
            page,
            limit,
            total: users.length,
            has_more: page * limit < users.length
        }
    });
});

app.post("/users", (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
        return errorResponse(res, 400, "Invalid request data", "VALIDATION_ERROR", {
            username: !username ? "Username is required" : null,
            email: !email ? "Email is required" : null,
            password: !password ? "Password is required" : null
        });
    }

    const newUser = {
        id: users.length + 1,
        username,
        email,
        created_at: new Date().toISOString()
    };

    users.push(newUser);

    res.setHeader("Location", `/users/${newUser.id}`);
    res.status(201).json(newUser);
});

app.get("/users/:userId", (req, res) => {
    const user = users.find((u) => u.id === parseInt(req.params.userId));

    if (!user) {
        return errorResponse(res, 404, "User not found", "NOT_FOUND");
    }

    res.json(user);
});

app.put("/users/:userId", (req, res) => {
    const user = users.find((u) => u.id === parseInt(req.params.userId));

    if (!user) {
        return errorResponse(res, 404, "User not found", "NOT_FOUND");
    }

    const { username, email } = req.body;
    Object.assign(user, { username, email });

    res.json(user);
});

app.delete("/users/:userId", (req, res) => {
    const index = users.findIndex((u) => u.id === parseInt(req.params.userId));

    if (index === -1) {
        return errorResponse(res, 404, "User not found", "NOT_FOUND");
    }

    users.splice(index, 1);
    res.status(204).end();
});

// Redirect endpoints
app.get("/redirect-temp", (req, res) => {
    res.redirect(302, "/users");
});

app.get("/redirect-permanent", (req, res) => {
    res.redirect(301, "/v2/users");
});

// Protected resource endpoints
app.get("/protected-resource", (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        res.setHeader("WWW-Authenticate", 'Bearer realm="api"');
        return errorResponse(res, 401, "Authentication required", "AUTH_REQUIRED");
    }

    res.json({ sensitive_data: "This is protected data" });
});

app.get("/admin-only", (req, res) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        return errorResponse(res, 401, "Authentication required", "AUTH_REQUIRED");
    }

    // Mock admin check
    if (authHeader !== "Bearer admin-token") {
        return errorResponse(res, 403, "Insufficient permissions", "FORBIDDEN");
    }

    res.json({ admin_data: "This is admin data" });
});

// File handling endpoints
app.get("/files/download/:fileId", (req, res) => {
    // Mock file download
    const dummyFile = Buffer.from("This is a dummy file content");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="document.pdf"');
    res.setHeader("Content-Length", dummyFile.length);
    res.send(dummyFile);
});

app.post("/files/upload", (req, res) => {
    // Mock file upload
    res.status(201).json({
        file_id: "file_123",
        filename: "uploaded_file.pdf",
        size: 1024,
        url: "/files/download/file_123"
    });
});

// Streaming endpoints
app.get("/stream/events", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    let count = 0;
    const interval = setInterval(() => {
        res.write(
            `data: ${JSON.stringify({
                event: count === 0 ? "user_joined" : "message",
                user: count === 0 ? "john" : undefined,
                text: count === 1 ? "Hello world" : undefined
            })}\n\n`
        );

        count++;
        if (count >= 2) {
            clearInterval(interval);
            res.end();
        }
    }, 1000);
});

app.get("/stream/data", (req, res) => {
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Transfer-Encoding", "chunked");

    let count = 0;
    const interval = setInterval(() => {
        res.write(`Chunk ${count}\n`);
        count++;

        if (count >= 5) {
            clearInterval(interval);
            res.end();
        }
    }, 1000);
});

// Search endpoint
app.get("/search", (req, res) => {
    const { q, type = "all" } = req.query;

    if (!q) {
        return errorResponse(res, 400, "Invalid search query", "VALIDATION_ERROR");
    }

    // Mock search results
    const results = [];
    if (type === "users" || type === "all") {
        results.push(...users.filter((u) => u.username.includes(q)));
    }
    if (type === "products" || type === "all") {
        results.push(...products.filter((p) => p.name.includes(q)));
    }

    if (results.length === 0) {
        return res.status(204).end();
    }

    res.json({
        results,
        total: results.length,
        query: q
    });
});

// Webhook endpoint
app.post("/webhooks/receive", (req, res) => {
    if (Math.random() > 0.5) {
        res.json({ status: "processed" });
    } else {
        res.status(202).json({
            status: "accepted",
            id: `webhook_${requestId++}`
        });
    }
});

// Health check endpoint
app.get("/health", (req, res) => {
    const isHealthy = Math.random() > 0.1; // 90% chance of being healthy

    if (isHealthy) {
        res.json({
            status: "healthy",
            timestamp: new Date().toISOString(),
            version: "1.0.0"
        });
    } else {
        res.status(503).json({
            status: "unhealthy",
            errors: ["Database connection failed", "Cache service unavailable"]
        });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log("\nAvailable endpoints:");
    console.log("- GET /users");
    console.log("- POST /users");
    console.log("- GET /users/:userId");
    console.log("- PUT /users/:userId");
    console.log("- DELETE /users/:userId");
    console.log("- GET /protected-resource");
    console.log("- GET /admin-only");
    console.log("- GET /files/download/:fileId");
    console.log("- POST /files/upload");
    console.log("- GET /stream/events");
    console.log("- GET /stream/data");
    console.log("- GET /search");
    console.log("- POST /webhooks/receive");
    console.log("- GET /health");
});
