import { initializeApp } from "firebase/app";
import {
  getDatabase,
  ref,
  get,
  set,
  update
} from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyAEMQk0vKGnW8eCetlvVwkx1gMRS7_hax0",
  authDomain: "dbs-esports.firebaseapp.com",
  databaseURL: "https://dbs-esports-default-rtdb.firebaseio.com",
  projectId: "dbs-esports",
  storageBucket: "dbs-esports.firebasestorage.app",
  messagingSenderId: "822176619077",
  appId: "1:822176619077:web:73c633bf841252014ba12c",
  measurementId: "G-MGNCF7PNVL"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

function generateKey() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  let result = "";

  for (let i = 0; i < 5; i++) {
    result += chars.charAt(
      Math.floor(Math.random() * chars.length)
    );
  }

  return `MEHEDI-${result}`;
}

export default async function handler(req, res) {

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const action = req.query.action;

  // =========================
  // HOME
  // =========================

  if (!action) {
    return res.status(200).json({
      success: true,
      name: "MEHEDI KEY API",
      status: "online",
      endpoints: {
        generate: "/api/index?action=gen-key&validity=24",
        check: "/api/index?action=check&key=MEHEDI-XXXXX",
        revoke: "/api/index?action=revoke&key=MEHEDI-XXXXX"
      }
    });
  }

  // =========================
  // GENERATE KEY
  // =========================

  if (action === "gen-key") {

    const validity = Number(req.query.validity);

    if (!validity || validity <= 0) {
      return res.status(400).json({
        success: false,
        error: "validity must be greater than 0"
      });
    }

    if (validity > 8760) {
      return res.status(400).json({
        success: false,
        error: "maximum validity is 8760 hours"
      });
    }

    let key;
    let existing;

    do {
      key = generateKey();

      const snapshot = await get(
        ref(database, `keys/${key}`)
      );

      existing = snapshot.exists();

    } while (existing);

    const createdAt = new Date();
    const expiresAt = new Date(
      createdAt.getTime() + validity * 60 * 60 * 1000
    );

    const data = {
      key,
      status: "active",
      validity_hours: validity,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      revoked: false
    };

    await set(
      ref(database, `keys/${key}`),
      data
    );

    return res.status(200).json({
      success: true,
      key,
      status: "active",
      validity_hours: validity,
      created_at: createdAt.toISOString(),
      expires_at: expiresAt.toISOString()
    });
  }

  // =========================
  // CHECK KEY
  // =========================

  if (action === "check") {

    const key = String(req.query.key || "")
      .trim()
      .toUpperCase();

    if (!key) {
      return res.status(400).json({
        success: false,
        valid: false,
        error: "key is required"
      });
    }

    const snapshot = await get(
      ref(database, `keys/${key}`)
    );

    if (!snapshot.exists()) {
      return res.status(200).json({
        success: true,
        valid: false,
        reason: "key_not_found"
      });
    }

    const data = snapshot.val();

    if (data.revoked === true) {
      return res.status(200).json({
        success: true,
        valid: false,
        reason: "revoked",
        key
      });
    }

    const now = Date.now();
    const expires = new Date(data.expires_at).getTime();

    if (now >= expires) {

      await update(
        ref(database, `keys/${key}`),
        {
          status: "expired"
        }
      );

      return res.status(200).json({
        success: true,
        valid: false,
        reason: "expired",
        key,
        expires_at: data.expires_at
      });
    }

    const remainingSeconds =
      Math.floor((expires - now) / 1000);

    return res.status(200).json({
      success: true,
      valid: true,
      status: "active",
      key,
      expires_at: data.expires_at,
      remaining_seconds: remainingSeconds
    });
  }

  // =========================
  // REVOKE
  // =========================

  if (action === "revoke") {

    const key = String(req.query.key || "")
      .trim()
      .toUpperCase();

    if (!key) {
      return res.status(400).json({
        success: false,
        error: "key is required"
      });
    }

    const snapshot = await get(
      ref(database, `keys/${key}`)
    );

    if (!snapshot.exists()) {
      return res.status(404).json({
        success: false,
        error: "key not found"
      });
    }

    await update(
      ref(database, `keys/${key}`),
      {
        status: "revoked",
        revoked: true,
        revoked_at: new Date().toISOString()
      }
    );

    return res.status(200).json({
      success: true,
      key,
      status: "revoked"
    });
  }

  return res.status(404).json({
    success: false,
    error: "unknown action"
  });
}
