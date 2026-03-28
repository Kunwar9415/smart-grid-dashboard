/**
 * ============================================================
 *  Smart Grid Cyber-Attack Monitoring — Backend Server
 *  File    : server.js
 *  Runtime : Node.js  (requires express, cors)
 *  Start   : node server.js
 * ============================================================
 */

const express = require("express");
const cors    = require("cors");
const path    = require("path");
const fs      = require("fs");

// ── App setup ────────────────────────────────────────────────
const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors());                        // allow frontend (any origin) to call API
app.use(express.json());                // parse JSON request bodies

// Serve static frontend files from ../frontend/
app.use(express.static(path.join(__dirname, "../frontend")));

// ── Load routes ──────────────────────────────────────────────
const dataRoutes    = require("./routes/data");
const predictRoutes = require("./routes/predict");
const historyRoutes = require("./routes/history");

app.use("/data",    dataRoutes);
app.use("/predict", predictRoutes);
app.use("/history", historyRoutes);

// Health-check
app.get("/health", (_req, res) =>
  res.json({ status: "ok", time: new Date().toISOString() })
);

// ── Start server ─────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n⚡  Smart Grid Server running at http://localhost:${PORT}`);
  console.log(`   Dashboard   → http://localhost:${PORT}`);
  console.log(`   /data       → GET  real-time grid values`);
  console.log(`   /predict    → POST { Voltage, Current, Power, Load }`);
  console.log(`   /history    → GET  attack log\n`);
});