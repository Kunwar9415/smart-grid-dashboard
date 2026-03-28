/**
 * Route  : GET /data
 * Purpose: Simulate real-time smart grid readings.
 *          Voltage, Current, Power, Load — core SCADA parameters.
 *          ~18% chance per tick to enter attack mode (4-8 ticks long).
 */

const express = require("express");
const router  = express.Router();

let attackActive    = false;
let attackCountdown = 0;

function rand(min, max, dec = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
}

function nextAttackState() {
  if (attackActive) {
    attackCountdown--;
    if (attackCountdown <= 0) attackActive = false;
  } else {
    if (Math.random() < 0.18) {
      attackActive    = true;
      attackCountdown = Math.floor(Math.random() * 5) + 4;
    }
  }
  return attackActive;
}

router.get("/", (_req, res) => {
  const attacking = nextAttackState();

  const voltage = attacking ? rand(260, 305, 1) : rand(210, 249, 1);
  const current = attacking ? rand(10.5, 15.8, 2) : rand(3.5, 8.5, 2);
  const load    = attacking ? rand(76, 99, 1)    : rand(20, 65, 1);
  const power   = parseFloat((voltage * current).toFixed(0));
  const frequency = attacking ? rand(48.0, 49.2, 2) : rand(49.8, 50.2, 2); // Hz
  const powerFactor = attacking ? rand(0.6, 0.8, 2) : rand(0.92, 0.99, 2);

  res.json({
    timestamp   : new Date().toISOString(),
    Voltage     : voltage,
    Current     : current,
    Power       : power,
    Load        : load,
    Frequency   : frequency,
    PowerFactor : powerFactor,
    simulated_attack: attacking
  });
});

module.exports = router;