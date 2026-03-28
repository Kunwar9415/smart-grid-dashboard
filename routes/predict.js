/**
 * Route   : POST /predict
 * Body    : { "Voltage": 280, "Current": 12, "Power": 3360, "Load": 82 }
 * Returns : { prediction, confidence, probAttack, probNormal, method }
 *
 * The model coefficients come from model.json which was produced by
 * the Python training script (train_model.py).  We re-implement the
 * logistic regression inference in plain JavaScript so the server has
 * zero Python dependency at runtime.
 *
 * Prediction strategy (in order):
 *  1. Load model.json from disk (cached after first load)
 *  2. Z-score normalise the four input features using the saved scaler
 *  3. Compute logistic regression score  →  P(Attack)
 *  4. ALSO run simple threshold rule as a safety net
 *  5. Ensemble: if either fires → "Cyber Attack"
 */

const express = require("express");
const path    = require("path");
const fs      = require("fs");

const router   = express.Router();
const MODEL_PATH = path.join(__dirname, "../model/model.json");

// ── Load model once ───────────────────────────────────────────
let MODEL = null;

function loadModel() {
  if (MODEL) return MODEL;
  if (!fs.existsSync(MODEL_PATH)) {
    throw new Error(
      "model.json not found. Run: python3 backend/model/train_model.py"
    );
  }
  MODEL = JSON.parse(fs.readFileSync(MODEL_PATH, "utf8"));
  console.log(`[Predict] Model loaded (accuracy: ${(MODEL.accuracy * 100).toFixed(1)}%)`);
  return MODEL;
}

// ── Maths helpers ─────────────────────────────────────────────
function sigmoid(z) {
  return 1 / (1 + Math.exp(-z));
}

/** Standard logistic regression: z = w·x + b */
function logisticPredict(model, features) {
  // z-score normalise
  const x = features.map(
    (v, i) => (v - model.scaler_mean[i]) / model.scaler_std[i]
  );
  // dot product + intercept
  const z = model.lr_coef.reduce((sum, w, i) => sum + w * x[i], 0)
            + model.lr_intercept;
  const prob = sigmoid(z);
  return prob;                // probability of Attack
}

/** Rule-based fallback using the thresholds stored in model.json */
function thresholdPredict(model, payload) {
  return (
    payload.Voltage > model.thresholds.Voltage ||
    payload.Current > model.thresholds.Current
  );
}

// ── Validation ────────────────────────────────────────────────
function validatePayload(body) {
  const required = ["Voltage", "Current", "Power", "Load"];
  for (const key of required) {
    if (body[key] === undefined || body[key] === null || isNaN(Number(body[key]))) {
      return `Missing or invalid field: ${key}`;
    }
  }
  return null;
}

// ── Handler ───────────────────────────────────────────────────
router.post("/", (req, res) => {
  // 1. Validate
  const validationError = validatePayload(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const { Voltage, Current, Power, Load } = req.body;

  // 2. Load model
  let model;
  try {
    model = loadModel();
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  // 3. Logistic Regression probability
  const features    = [Voltage, Current, Power, Load];
  const probAttack  = logisticPredict(model, features);
  const lrAttack    = probAttack >= 0.50;

  // 4. Threshold rule
  const ruleAttack  = thresholdPredict(model, { Voltage, Current });

  // 5. Ensemble: flag if either method fires
  const isAttack    = lrAttack || ruleAttack;
  const prediction  = isAttack ? "Cyber Attack" : "Normal";

  // Confidence = distance from 0.5, capped to nice %
  const confidence  = Math.min(99, Math.round(Math.abs(probAttack - 0.5) * 200));

  res.json({
    prediction,
    isAttack,
    probAttack  : parseFloat(probAttack.toFixed(4)),
    probNormal  : parseFloat((1 - probAttack).toFixed(4)),
    confidence,
    lr_fired    : lrAttack,
    rule_fired  : ruleAttack,
    timestamp   : new Date().toISOString()
  });
});

module.exports = router;