/**
 * Route   : GET  /history          → returns last N logged events
 *           POST /history          → (internal) appends a new event
 *           DELETE /history        → clears the log
 *
 * The predict route calls POST /history internally after every
 * prediction so the history is always up-to-date.
 *
 * Storage : in-memory array (resets on server restart).
 *           For persistence, swap the array for a SQLite/JSON-file write.
 */

const express = require("express");
const router  = express.Router();

// ── In-memory store ───────────────────────────────────────────
const MAX_HISTORY = 200;   // keep last 200 events
let   eventLog    = [];

/** Called internally (not by the frontend) to append an event */
function addEvent(event) {
  eventLog.unshift({ ...event, id: Date.now() });  // newest first
  if (eventLog.length > MAX_HISTORY) eventLog.length = MAX_HISTORY;
}

// Expose addEvent so predict.js can import and use it
module.exports = router;
module.exports.addEvent = addEvent;

// ── GET /history ──────────────────────────────────────────────
router.get("/", (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit || "50"), 200);
  const filter = req.query.filter;  // "attack" | "normal" | undefined

  let data = eventLog.slice(0, limit);
  if (filter === "attack") data = data.filter(e => e.isAttack);
  if (filter === "normal") data = data.filter(e => !e.isAttack);

  res.json({
    total  : eventLog.length,
    attacks: eventLog.filter(e => e.isAttack).length,
    normals: eventLog.filter(e => !e.isAttack).length,
    events : data
  });
});

// ── POST /history (internal use) ─────────────────────────────
router.post("/", (req, res) => {
  if (!req.body || !req.body.prediction) {
    return res.status(400).json({ error: "Missing prediction field" });
  }
  addEvent(req.body);
  res.json({ ok: true, total: eventLog.length });
});

// ── DELETE /history ───────────────────────────────────────────
router.delete("/", (_req, res) => {
  eventLog = [];
  res.json({ ok: true, message: "History cleared" });
});