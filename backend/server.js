require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const WebSocket = require("ws");
const getChatResponse = require("./chat");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const db = require("./db");
const initDb = require("./initDb");

db.getConnection((err) => {
  if (err) {
    console.log("Database connection failed:", err.message);
  } else {
    console.log("MySQL Connected");
    initDb(); // Initialize tables
  }
});

// Routes
const testRoutes = require("./routes/testroutes");
app.use("/api", testRoutes);

// Root route
app.get("/", (req, res) => {
  res.send("AI Grading Backend with WebSockets Running");
});

// WebSocket connection
wss.on("connection", (ws) => {
  console.log("A user connected to the pure WebSocket assistant");

  ws.on("message", async (data) => {
    try {
      const parsedData = JSON.parse(data);
      const { type, payload } = parsedData;

      if (type === "ping-socket") {
        console.log("Ping received from client");
        ws.send(JSON.stringify({ type: "pong-socket", payload: { message: "Connection Alive!" } }));
      }

      if (type === "ask-doubt") {
        console.log("Doubt received from user:", payload.message);
        const aiResponse = await getChatResponse(payload.message, payload.context);
        ws.send(JSON.stringify({ type: "receive-response", payload: { message: aiResponse } }));
      }
    } catch (err) {
      console.error("WebSocket message error:", err.message);
    }
  });

  ws.on("close", () => {
    console.log("User disconnected from WebSocket");
  });
});

// Start server
const PORT = process.env.PORT || 5002;
if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server successfully started on port ${PORT} (Pure WebSockets)`);
  });
}

module.exports = app;
