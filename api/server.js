const express = require('express');
const cors    = require('cors');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const Database = require('better-sqlite3');
const crypto  = require('crypto');

const app  = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET  = process.env.JWT_SECRET  || 'change-me-in-production';
const LEMON_API_KEY = process.env.LEMON_API_KEY || '';   // clé Lemon Squeezy
const LEMON_STORE_ID = process.env.LEMON_STORE_ID || ''; // ID du store

// ── DB ──────────────────────────────────────────────────────────────────────
const db = new Database(process.env.DB_PATH || './data.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    email    TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    license  TEXT,
    created  INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS sync_data (
    user_id   INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    payload   TEXT NOT NULL,
    updated   INTEGER DEFAULT (strftime('%s','now'))
  );
  CREATE TABLE IF NOT EXISTS resets (
    email   TEXT NOT NULL,
    token   TEXT NOT NULL,
    expires INTEGER NOT NULL
  );
`);

// ── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: ['https://hfp-coach.ch', 'https://www.hfp-coach.ch', 'http://localhost:8765'] }));
app.use(express.json({ limit: '512kb' }));

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
}

// ── Lemon Squeezy ────────────────────────────────────────────────────────────
async function validateLemonLicense(licenseKey) {
  if (!LEMON_API_KEY) return { valid: false, error: 'API non configurée' };
  try {
    const res = await fetch('https://api.lemonsqueezy.com/v1/licenses/validate', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${LEMON_API_KEY}`
      },
      body: JSON.stringify({ license_key: licenseKey })
    });
    const data = await res.json();
    const ok = data?.activated || data?.license_key?.status === 'active';
    return { valid: ok, meta: data };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

// ── Routes ───────────────────────────────────────────────────────────────────

// Santé
app.get('/api/health', (_, res) => res.json({ ok: true, version: '1.0.0' }));

// Inscription
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password || password.length < 8)
    return res.status(400).json({ error: 'Email ou mot de passe invalide (8 caractères min)' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const stmt = db.prepare('INSERT INTO users (email, password) VALUES (?, ?)');
    const info = stmt.run(email.toLowerCase().trim(), hash);
    const token = jwt.sign({ uid: info.lastInsertRowid, email }, JWT_SECRET, { expiresIn: '90d' });
    res.json({ token, email });
  } catch {
    res.status(409).json({ error: 'Cet email est déjà utilisé' });
  }
});

// Connexion
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get((email || '').toLowerCase().trim());
  if (!user || !(await bcrypt.compare(password || '', user.password)))
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  const token = jwt.sign({ uid: user.id, email: user.email }, JWT_SECRET, { expiresIn: '90d' });
  res.json({ token, email: user.email, license: user.license || null });
});

// Activation de licence
app.post('/api/activate-license', auth, async (req, res) => {
  const { licenseKey } = req.body || {};
  if (!licenseKey) return res.status(400).json({ error: 'Clé manquante' });

  // Validation Lemon Squeezy si configuré
  const lemon = await validateLemonLicense(licenseKey);
  if (!lemon.valid && LEMON_API_KEY) {
    return res.status(400).json({ error: 'Licence invalide ou déjà utilisée' });
  }

  // Fallback local : format IOBSP-XXXXXXXXXXXX (si Lemon non configuré)
  if (!LEMON_API_KEY) {
    if (!licenseKey.startsWith('IOBSP-') || licenseKey.length < 12)
      return res.status(400).json({ error: 'Format de licence invalide' });
  }

  db.prepare('UPDATE users SET license = ? WHERE id = ?').run(licenseKey, req.user.uid);
  res.json({ success: true });
});

// Sync progression (sauvegarde)
app.post('/api/sync', auth, (req, res) => {
  const payload = JSON.stringify(req.body || {});
  db.prepare(`
    INSERT INTO sync_data (user_id, payload, updated) VALUES (?, ?, strftime('%s','now'))
    ON CONFLICT(user_id) DO UPDATE SET payload = excluded.payload, updated = excluded.updated
  `).run(req.user.uid, payload);
  res.json({ ok: true });
});

// Sync progression (restauration)
app.get('/api/sync', auth, (req, res) => {
  const row = db.prepare('SELECT payload, updated FROM sync_data WHERE user_id = ?').get(req.user.uid);
  if (!row) return res.json({ data: null });
  res.json({ data: JSON.parse(row.payload), updated: row.updated });
});

// Mot de passe oublié
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get((email || '').toLowerCase().trim());
  // Toujours répondre OK (sécurité)
  if (!user) return res.json({ ok: true });

  const token = crypto.randomBytes(32).toString('hex');
  const expires = Math.floor(Date.now() / 1000) + 3600; // 1h
  db.prepare('DELETE FROM resets WHERE email = ?').run(email);
  db.prepare('INSERT INTO resets (email, token, expires) VALUES (?, ?, ?)').run(email, token, expires);

  // TODO : envoyer l'email avec nodemailer
  // const resetUrl = `https://hfp-coach.ch/app.html#reset?token=${token}&email=${encodeURIComponent(email)}`;
  console.log(`[reset] ${email} → token: ${token}`);

  res.json({ ok: true });
});

// Réinitialisation mot de passe
app.post('/api/reset-password', async (req, res) => {
  const { email, token, newPassword } = req.body || {};
  if (!newPassword || newPassword.length < 8)
    return res.status(400).json({ error: 'Mot de passe trop court (8 caractères min)' });

  const now = Math.floor(Date.now() / 1000);
  const row = db.prepare('SELECT * FROM resets WHERE email = ? AND token = ? AND expires > ?')
                .get((email || '').toLowerCase().trim(), token || '', now);
  if (!row) return res.status(400).json({ error: 'Lien expiré ou invalide' });

  const hash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password = ? WHERE email = ?').run(hash, row.email);
  db.prepare('DELETE FROM resets WHERE email = ?').run(row.email);
  res.json({ ok: true });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => console.log(`API iobsp-coach démarrée sur le port ${PORT}`));
