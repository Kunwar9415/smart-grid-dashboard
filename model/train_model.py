"""
============================================================
  Smart Grid Cyber-Attack Detection — Model Trainer
  Filename : train_model.py
  Purpose  : Generate synthetic dataset, train an Isolation
             Forest + Logistic Regression ensemble, then
             export the model parameters to JSON so the
             Node.js backend can use them without Python at
             runtime.
============================================================
  Run once before starting the server:
      python3 train_model.py
============================================================
"""

import json, os, random
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import IsolationForest
from sklearn.metrics import (
    classification_report, confusion_matrix, accuracy_score
)

# ── Paths ────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "../dataset/smart_grid_data.csv")
MODEL_PATH   = os.path.join(BASE_DIR, "model.json")

# ── 1. Generate / load dataset ───────────────────────────────
def generate_dataset(n_samples=2000):
    """
    Produces a labelled synthetic smart-grid dataset.
    Normal operating ranges are based on IEC 60038 standard voltages.
    Attack values are intentionally spiked to simulate injection / tampering.
    """
    random.seed(42)
    np.random.seed(42)
    rows = []

    for _ in range(n_samples):
        is_attack = random.random() < 0.30      # ~30 % attack rate

        if is_attack:
            voltage = round(random.uniform(260, 310), 2)   # over-voltage
            current = round(random.uniform(10,  16),  2)   # over-current
            load    = round(random.uniform(75,  100), 2)   # high load
        else:
            voltage = round(random.uniform(210, 249), 2)   # normal voltage
            current = round(random.uniform(3.5, 8.5), 2)   # normal current
            load    = round(random.uniform(20,  65),  2)   # normal load

        power = round(voltage * current, 2)                # P = V × I
        label = "Attack" if is_attack else "Normal"
        rows.append([voltage, current, power, load, label])

    df = pd.DataFrame(rows, columns=["Voltage","Current","Power","Load","Label"])
    os.makedirs(os.path.dirname(DATASET_PATH), exist_ok=True)
    df.to_csv(DATASET_PATH, index=False)
    print(f"[Dataset] Saved {len(df)} rows → {DATASET_PATH}")
    print(df["Label"].value_counts().to_string(), "\n")
    return df

# ── 2. Train ─────────────────────────────────────────────────
def train(df):
    FEATURES = ["Voltage", "Current", "Power", "Load"]
    X = df[FEATURES].values
    y = (df["Label"] == "Attack").astype(int).values   # 1=Attack, 0=Normal

    # --- Standardise features ---
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # --- Logistic Regression (supervised) ---
    lr = LogisticRegression(max_iter=500, random_state=42, C=1.0)
    lr.fit(X_scaled, y)

    # --- Isolation Forest (unsupervised anomaly detection) ---
    iso = IsolationForest(
        n_estimators=100,
        contamination=0.30,   # expected fraction of anomalies
        random_state=42
    )
    iso.fit(X_scaled)
    # IsolationForest returns -1 (anomaly) or +1 (normal) → convert to 0/1
    iso_preds = (iso.predict(X_scaled) == -1).astype(int)

    # --- Ensemble: majority vote ---
    lr_preds  = lr.predict(X_scaled)
    ensemble  = ((lr_preds + iso_preds) >= 1).astype(int)

    # --- Metrics ---
    acc = accuracy_score(y, ensemble)
    print(f"[Model] Ensemble Accuracy : {acc*100:.1f}%")
    print(classification_report(y, ensemble, target_names=["Normal","Attack"]))

    # ── 3. Export model to JSON ──────────────────────────────
    # We serialise only what the Node.js predict endpoint needs:
    #   • Scaler mean & std  (for z-score normalisation)
    #   • LR coefficients & intercept
    #   • Thresholds (simple rule-based fallback)
    model_data = {
        "scaler_mean":   scaler.mean_.tolist(),
        "scaler_std":    scaler.scale_.tolist(),
        "lr_coef":       lr.coef_[0].tolist(),
        "lr_intercept":  float(lr.intercept_[0]),
        "features":      FEATURES,
        "thresholds": {
            "Voltage": 250,
            "Current": 9
        },
        "accuracy": round(float(acc), 4)
    }

    os.makedirs(os.path.dirname(MODEL_PATH), exist_ok=True)
    with open(MODEL_PATH, "w") as f:
        json.dump(model_data, f, indent=2)
    print(f"[Model] Exported to {MODEL_PATH}")
    return model_data

# ── Entry point ──────────────────────────────────────────────
if __name__ == "__main__":
    if os.path.exists(DATASET_PATH):
        print(f"[Dataset] Loading existing file: {DATASET_PATH}")
        df = pd.read_csv(DATASET_PATH)
    else:
        df = generate_dataset()

    train(df)
    print("\n✅  Training complete. You can now start the backend server.")