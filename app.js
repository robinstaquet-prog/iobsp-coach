// =====================================================
//  IOBSP COACH — Application Logic
//  Vanilla JS SPA — No framework
// =====================================================

// === 1. CONSTANTES ===

const ALL_CATEGORIES = [
  'Réglementation',
  'Environnement bancaire',
  'Crédit immobilier',
  'Crédit à la consommation',
  'Regroupement de crédits',
  'Protection du consommateur',
  'Déontologie',
  'LCB-FT'
];

const LS_STATS      = 'iobsp-stats';
const LS_ERRORS     = 'iobsp-errors';
const LS_SESSIONS   = 'iobsp-sessions';
const LS_MASTERY    = 'iobsp-mastery';
const LS_FC_MASTERY = 'iobsp-fc-mastery';
const LS_LICENSE    = 'iobsp-license';
const LS_AUTH_TOKEN = 'iobsp-auth-token';
const LS_AUTH_EMAIL = 'iobsp-auth-email';
const API_BASE      = 'https://api.hfp-coach.ch';
const LEMON_SQUEEZY_URL = 'https://actiongap.lemonsqueezy.com/checkout/buy/iobsp-coach';

// === 1b. FREEMIUM ===

const FREE_QUESTION_IDS = new Set([
  'Q1','Q2','Q3','Q4','Q5','Q6','Q7','Q8','Q9','Q10',
  'Q11','Q12','Q13','Q14','Q15','Q16','Q17','Q18','Q19','Q20',
  'Q21','Q22','Q23','Q24','Q25'
]);
const FREE_FLASHCARD_IDS = new Set([
  'FC001','FC002','FC003','FC004','FC005','FC006','FC007','FC008','FC009','FC010',
  'FC011','FC012','FC013','FC014','FC015','FC016','FC017','FC018','FC019','FC020'
]);

function isPremium() {
  const license = localStorage.getItem(LS_LICENSE);
  return !!license && license.length > 10;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getFreeQuestions() {
  return window.QUESTIONS.filter(q => FREE_QUESTION_IDS.has(q.id));
}

function getFreeFlashcards() {
  return window.FLASHCARDS.filter(fc => FREE_FLASHCARD_IDS.has(fc.id));
}

function getAvailableQuestions() {
  return isPremium() ? window.QUESTIONS : getFreeQuestions();
}

function getAvailableFlashcards() {
  return isPremium() ? window.FLASHCARDS : getFreeFlashcards();
}

function showUpgradePrompt(context) {
  const messages = {
    questions: `Vous avez accès à ${FREE_QUESTION_IDS.size} questions gratuites sur ${window.QUESTIONS.length}. L'accès complet débloque toutes les questions, la révision adaptative SM-2 et les explications détaillées.`,
    flashcards: `Vous avez accès à ${FREE_FLASHCARD_IDS.size} flashcards gratuites sur ${window.FLASHCARDS.length}. L'accès complet débloque toutes les catégories réglementaires.`,
    adaptive: `La Révision intelligente est une fonctionnalité premium. Elle adapte les questions à vos lacunes grâce à l'algorithme SM-2.`,
    knowledge: `La Carte de connaissances complète est réservée à l'accès premium.`
  };

  const overlay = document.createElement('div');
  overlay.className = 'upgrade-overlay';
  overlay.innerHTML = `
    <div class="upgrade-modal">
      <div class="upgrade-icon">🔒</div>
      <h2>Accès complet</h2>
      <p>${messages[context] || messages.questions}</p>
      <ul class="upgrade-features">
        <li>✓ ${window.QUESTIONS.length} questions réglementaires IOBSP</li>
        <li>✓ ${window.FLASHCARDS.length} flashcards avec filtrage par module</li>
        <li>✓ Révision intelligente SM-2 adaptative</li>
        <li>✓ Explications et références légales illimitées</li>
        <li>✓ Suivi de progression multi-appareils</li>
      </ul>
      <div class="upgrade-price">49 € <span class="upgrade-once">· Achat unique · Accès à vie</span></div>
      <a href="${LEMON_SQUEEZY_URL}" target="_blank" class="btn btn-primary upgrade-btn">Débloquer l'accès complet</a>
      <div class="upgrade-license">
        <p>Déjà un code ? <a href="#" onclick="promptLicenseInput(event)">Entrer mon code de licence</a></p>
      </div>
      <button class="btn-link upgrade-close" onclick="this.closest('.upgrade-overlay').remove()">Fermer</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function promptLicenseInput(e) {
  if (e) e.preventDefault();
  const code = prompt('Entrez votre code de licence IOBSP :');
  if (code && code.trim().length > 5) {
    if (isLoggedIn()) {
      const result = await apiCall('/api/activate-license', 'POST', { licenseKey: code.trim() });
      if (result.success) {
        localStorage.setItem(LS_LICENSE, code.trim());
        alert('Licence activée ! L\'app va se recharger.');
        location.reload();
      } else {
        alert(result.error || 'Code de licence invalide.');
      }
    } else {
      // Sans compte : on stocke directement (validation légère côté client)
      if (code.trim().startsWith('IOBSP-') && code.trim().length >= 12) {
        localStorage.setItem(LS_LICENSE, code.trim());
        alert('Licence activée ! L\'app va se recharger.');
        location.reload();
      } else {
        alert('Code invalide. Format attendu : IOBSP-XXXXXXXXXXXX');
      }
    }
  } else if (code) {
    alert('Code trop court.');
  }
}

// === 1c. AUTH & SYNC ===

function isLoggedIn() {
  return !!localStorage.getItem(LS_AUTH_TOKEN);
}

function getAuthToken() {
  return localStorage.getItem(LS_AUTH_TOKEN);
}

function getAuthEmail() {
  return localStorage.getItem(LS_AUTH_EMAIL);
}

async function apiCall(endpoint, method, body) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getAuthToken();
  if (token) headers['Authorization'] = 'Bearer ' + token;
  try {
    const res = await fetch(API_BASE + endpoint, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined
    });
    return await res.json();
  } catch {
    return { error: 'Connexion impossible' };
  }
}

async function doRegister(email, password) {
  const result = await apiCall('/api/register', 'POST', { email, password });
  if (result.token) {
    localStorage.setItem(LS_AUTH_TOKEN, result.token);
    localStorage.setItem(LS_AUTH_EMAIL, result.email);
  }
  return result;
}

async function doLogin(email, password) {
  const result = await apiCall('/api/login', 'POST', { email, password });
  if (result.token) {
    localStorage.setItem(LS_AUTH_TOKEN, result.token);
    localStorage.setItem(LS_AUTH_EMAIL, result.email);
    if (result.license) localStorage.setItem(LS_LICENSE, result.license);
    if (result.hasData) await syncFromServer();
  }
  return result;
}

function doLogout() {
  localStorage.removeItem(LS_AUTH_TOKEN);
  localStorage.removeItem(LS_AUTH_EMAIL);
  renderAuthStatus();
}

let _syncLock = false;

async function syncToServer() {
  if (!isLoggedIn() || _syncLock) return;
  _syncLock = true;
  try {
    const data = exportAllData();
    data.lastModified = new Date().toISOString();
    data.lastSyncedAt = localStorage.getItem('iobsp-last-synced') || '1970-01-01';
    const result = await apiCall('/api/sync', 'POST', data);
    if (result.action === 'uploaded') {
      localStorage.setItem('iobsp-last-synced', data.lastModified);
    } else if (result.action === 'conflict' && result.data) {
      importAllData(result.data);
      localStorage.setItem('iobsp-last-synced', result.data.serverTimestamp || new Date().toISOString());
    }
  } finally {
    _syncLock = false;
  }
}

async function syncFromServer(forceOverwrite) {
  if (!isLoggedIn() || _syncLock) return;
  _syncLock = true;
  try {
    const result = await apiCall('/api/sync', 'GET');
    if (result.data) {
      importAllData(result.data, !!forceOverwrite);
      if (result.license) localStorage.setItem(LS_LICENSE, result.license);
      localStorage.setItem('iobsp-last-synced', result.data.serverTimestamp || new Date().toISOString());
    }
  } finally {
    _syncLock = false;
  }
}

function exportAllData() {
  return {
    stats: localStorage.getItem(LS_STATS),
    errors: localStorage.getItem(LS_ERRORS),
    sessions: localStorage.getItem(LS_SESSIONS),
    mastery: localStorage.getItem(LS_MASTERY),
    fcMastery: localStorage.getItem(LS_FC_MASTERY),
  };
}

function importAllData(data, overwrite) {
  if (!data) return;
  const keys = ['stats', 'errors', 'sessions', 'mastery', 'fcMastery'];
  const lsMap = { stats: LS_STATS, errors: LS_ERRORS, sessions: LS_SESSIONS, mastery: LS_MASTERY, fcMastery: LS_FC_MASTERY };
  keys.forEach(k => {
    if (data[k] && (overwrite || !localStorage.getItem(lsMap[k]))) {
      localStorage.setItem(lsMap[k], data[k]);
    }
  });
  _masteryCache = null;
  _fcMasteryCache = null;
}

function showAuthScreen() {
  const container = document.getElementById('auth-content');
  if (!container) return;

  if (isLoggedIn()) {
    container.innerHTML = `
      <div class="auth-logged-in">
        <p>Connecté en tant que <strong>${escapeHtml(getAuthEmail())}</strong></p>
        <p style="font-size:13px;color:var(--text-muted);margin:8px 0 16px">Votre progression se synchronise automatiquement entre vos appareils.</p>
        <div class="auth-buttons">
          <button class="btn btn-sm btn-primary" onclick="syncToServer().then(() => { alert('Progression sauvegardée sur le serveur !'); })">Sauvegarder maintenant</button>
          <button class="btn btn-sm btn-secondary" onclick="if(confirm('Cela remplacera vos données locales par celles du serveur. Continuer ?')) syncFromServer(true).then(() => { alert('Données restaurées depuis le serveur !'); showHome(); })">Restaurer depuis le serveur</button>
          <button class="btn btn-sm btn-secondary" onclick="doLogout(); showHome();">Déconnexion</button>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="auth-form">
        <div class="auth-tabs">
          <button class="auth-tab auth-tab-active" onclick="switchAuthTab('login')">Connexion</button>
          <button class="auth-tab" onclick="switchAuthTab('register')">Inscription</button>
        </div>
        <div id="auth-login-form">
          <input type="email" id="auth-email" class="fc-config-input" placeholder="Email" style="margin-bottom:8px">
          <input type="password" id="auth-password" class="fc-config-input" placeholder="Mot de passe" style="margin-bottom:12px">
          <button class="btn btn-primary" style="width:100%" onclick="handleLogin()">Se connecter</button>
          <p style="text-align:center;margin-top:10px;font-size:12px"><a href="#" onclick="handleForgotPassword(event)" style="color:#64748b">Mot de passe oublié ?</a></p>
        </div>
        <div id="auth-register-form" class="hidden">
          <input type="email" id="reg-email" class="fc-config-input" placeholder="Email" style="margin-bottom:8px">
          <input type="password" id="reg-password" class="fc-config-input" placeholder="Mot de passe (min 6 car.)" style="margin-bottom:8px">
          <input type="password" id="reg-password2" class="fc-config-input" placeholder="Confirmer le mot de passe" style="margin-bottom:12px">
          <button class="btn btn-primary" style="width:100%" onclick="handleRegister()">Créer mon compte</button>
        </div>
        <p id="auth-error" class="auth-error hidden"></p>
      </div>
    `;
  }
  showScreen('auth-screen');
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(el => el.classList.remove('auth-tab-active'));
  if (tab === 'login') {
    document.getElementById('auth-login-form').classList.remove('hidden');
    document.getElementById('auth-register-form').classList.add('hidden');
    document.querySelectorAll('.auth-tab')[0].classList.add('auth-tab-active');
  } else {
    document.getElementById('auth-login-form').classList.add('hidden');
    document.getElementById('auth-register-form').classList.remove('hidden');
    document.querySelectorAll('.auth-tab')[1].classList.add('auth-tab-active');
  }
}

async function handleForgotPassword(e) {
  if (e) e.preventDefault();
  const email = document.getElementById('auth-email').value.trim();
  if (!email) { alert('Entrez votre email dans le champ ci-dessus, puis cliquez à nouveau.'); return; }
  await apiCall('/api/forgot-password', 'POST', { email });
  alert('Si ce compte existe, un email de réinitialisation a été envoyé. Vérifiez vos spams.\n\nSi vous ne recevez rien, contactez : robin@actiongap.ch');
}

async function handleLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const errEl = document.getElementById('auth-error');
  errEl.classList.add('hidden');
  if (!email || !password) { errEl.textContent = 'Remplissez tous les champs.'; errEl.classList.remove('hidden'); return; }
  const btn = document.querySelector('#auth-login-form .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Connexion...'; }
  const result = await doLogin(email, password);
  if (btn) { btn.disabled = false; btn.textContent = 'Se connecter'; }
  if (result.error) { errEl.textContent = result.error; errEl.classList.remove('hidden'); return; }
  showHome();
}

async function handleRegister() {
  const email = document.getElementById('reg-email').value.trim();
  const pw = document.getElementById('reg-password').value;
  const pw2 = document.getElementById('reg-password2').value;
  const errEl = document.getElementById('auth-error');
  errEl.classList.add('hidden');
  if (!email || !pw) { errEl.textContent = 'Remplissez tous les champs.'; errEl.classList.remove('hidden'); return; }
  if (pw !== pw2) { errEl.textContent = 'Les mots de passe ne correspondent pas.'; errEl.classList.remove('hidden'); return; }
  if (pw.length < 6) { errEl.textContent = 'Mot de passe trop court (min 6 caractères).'; errEl.classList.remove('hidden'); return; }
  const btn = document.querySelector('#auth-register-form .btn-primary');
  if (btn) { btn.disabled = true; btn.textContent = 'Création...'; }
  const result = await doRegister(email, pw);
  if (btn) { btn.disabled = false; btn.textContent = 'Créer mon compte'; }
  if (result.error) { errEl.textContent = result.error; errEl.classList.remove('hidden'); return; }
  await syncToServer();
  showHome();
}

function renderAuthStatus() {
  const el = document.getElementById('auth-status');
  if (!el) return;
  if (isLoggedIn()) {
    el.innerHTML = `<span class="auth-badge" onclick="showAuthScreen()">👤 ${escapeHtml(getAuthEmail())}</span>`;
  } else {
    el.innerHTML = `<a href="#" class="auth-link" onclick="showAuthScreen(); return false;">Se connecter / S'inscrire</a>`;
  }
}

// === 2. ÉTAT DE L'APPLICATION ===

let state = {
  mode: null,
  sessionQuestions: [],
  currentIndex: 0,
  userAnswers: [],
  scores: [],
  answerTimes: [],
  validated: false,
  examTimerId: null,
  examTimeLeft: 0,
  examAnswered: null,
  lastWrongIds: [],
  questionStartTime: null,
  fcSession: [],
  fcIndex: 0,
  fcFlipped: false,
  fcResults: [],
};

// === 3. LOCALSTORAGE ===

function loadStats() {
  const raw = localStorage.getItem(LS_STATS);
  if (!raw) return { totalAnswered: 0, totalCorrect: 0, byCategory: {} };
  try { return JSON.parse(raw); } catch { return { totalAnswered: 0, totalCorrect: 0, byCategory: {} }; }
}

function saveStats(stats) {
  localStorage.setItem(LS_STATS, JSON.stringify(stats));
}

function loadErrors() {
  const raw = localStorage.getItem(LS_ERRORS);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function saveErrors(errors) {
  const validIds = new Set(window.QUESTIONS.map(q => q.id));
  const clean = [...new Set(errors)].filter(id => validIds.has(id));
  localStorage.setItem(LS_ERRORS, JSON.stringify(clean));
}

function loadSessions() {
  const raw = localStorage.getItem(LS_SESSIONS);
  try { return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function saveSessions(sessions) {
  localStorage.setItem(LS_SESSIONS, JSON.stringify(sessions.slice(-20)));
}

function resetAll() {
  if (confirm('Réinitialiser toutes les statistiques et le pool d\'erreurs ? Cette action est irréversible.')) {
    [LS_STATS, LS_ERRORS, LS_SESSIONS, LS_MASTERY, LS_FC_MASTERY].forEach(k => localStorage.removeItem(k));
    _masteryCache = null;
    _fcMasteryCache = null;
    renderStats();
  }
}

// === 3b. SM-2 SPACED REPETITION ===

let _masteryCache = null;
let _fcMasteryCache = null;

function loadMastery() {
  if (_masteryCache) return _masteryCache;
  const raw = localStorage.getItem(LS_MASTERY);
  if (!raw) { _masteryCache = { version: 1, cards: {}, stats: { streakDays: 0, lastActiveDate: null, totalReviews: 0 } }; return _masteryCache; }
  try { _masteryCache = JSON.parse(raw); } catch { _masteryCache = { version: 1, cards: {}, stats: { streakDays: 0, lastActiveDate: null, totalReviews: 0 } }; }
  return _masteryCache;
}

function saveMastery(mastery) {
  _masteryCache = mastery;
  localStorage.setItem(LS_MASTERY, JSON.stringify(mastery));
}

function loadFcMastery() {
  if (_fcMasteryCache) return _fcMasteryCache;
  const raw = localStorage.getItem(LS_FC_MASTERY);
  if (!raw) { _fcMasteryCache = { version: 1, cards: {} }; return _fcMasteryCache; }
  try { _fcMasteryCache = JSON.parse(raw); } catch { _fcMasteryCache = { version: 1, cards: {} }; }
  return _fcMasteryCache;
}

function saveFcMastery(fcMastery) {
  _fcMasteryCache = fcMastery;
  localStorage.setItem(LS_FC_MASTERY, JSON.stringify(fcMastery));
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sm2Update(card, grade) {
  if (!card) {
    card = { ef: 2.5, interval: 0, reps: 0, nextReview: todayISO(), lastReview: null, lastGrade: 0, lapses: 0, history: [] };
  }
  card.history = (card.history || []).slice(-9);
  card.history.push({ date: todayISO(), grade });
  card.lastReview = todayISO();
  card.lastGrade = grade;

  if (grade < 3) {
    card.lapses = (card.lapses || 0) + 1;
    card.reps = 0;
    card.interval = 1;
    card.ef = Math.max(1.3, card.ef - 0.3);
  } else {
    card.reps = (card.reps || 0) + 1;
    if (card.reps === 1) card.interval = 1;
    else if (card.reps === 2) card.interval = 3;
    else card.interval = Math.round(card.interval * card.ef);

    if (grade === 3) card.interval = Math.round(card.interval * 0.8);
    else if (grade === 4) card.ef = Math.min(3.0, card.ef + 0.05);
    else if (grade === 5) { card.ef = Math.min(3.0, card.ef + 0.15); card.interval = Math.round(card.interval * 1.3); }
  }

  if (card.lapses >= 4) card.interval = Math.max(1, Math.round(card.interval / 2));
  card.interval = Math.min(180, Math.max(1, card.interval));

  const next = new Date();
  next.setDate(next.getDate() + card.interval);
  card.nextReview = next.toISOString().slice(0, 10);
  return card;
}

function quizScoreToGrade(score, timeMs) {
  if (score === 0) return 1;
  if (timeMs < 5000) return 5;
  if (timeMs > 20000) return 3;
  return 4;
}

function updateQuestionMastery(questionId, grade) {
  const mastery = loadMastery();
  mastery.cards[questionId] = sm2Update(mastery.cards[questionId] || null, grade);
  mastery.stats.totalReviews++;
  const today = todayISO();
  if (mastery.stats.lastActiveDate !== today) {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (mastery.stats.lastActiveDate === yesterday.toISOString().slice(0, 10)) mastery.stats.streakDays++;
    else mastery.stats.streakDays = 1;
    mastery.stats.lastActiveDate = today;
  }
  saveMastery(mastery);
}

function updateFlashcardMastery(fcId, grade) {
  const fcMastery = loadFcMastery();
  fcMastery.cards[fcId] = sm2Update(fcMastery.cards[fcId] || null, grade);
  saveFcMastery(fcMastery);
  const mastery = loadMastery();
  mastery.stats.totalReviews++;
  const today = todayISO();
  if (mastery.stats.lastActiveDate !== today) {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    if (mastery.stats.lastActiveDate === yesterday.toISOString().slice(0, 10)) mastery.stats.streakDays++;
    else mastery.stats.streakDays = 1;
    mastery.stats.lastActiveDate = today;
  }
  saveMastery(mastery);
}

function masteryLevel(card) {
  if (!card) return 0;
  const efScore = ((card.ef - 1.3) / 1.2) * 40;
  const repScore = Math.min(card.reps / 5, 1) * 35;
  const lapseScore = Math.max(0, 25 - (card.lapses || 0) * 8);
  return Math.round(Math.min(100, Math.max(0, efScore + repScore + lapseScore)));
}

function masteryLabel(card) {
  if (!card) return { text: 'Nouveau', color: '#6b7280', icon: '○' };
  const level = masteryLevel(card);
  if (level >= 75) return { text: 'Maîtrisé', color: '#059669', icon: '●' };
  if (level >= 45) return { text: 'En révision', color: '#1E3A5F', icon: '◐' };
  return { text: 'En apprentissage', color: '#C9A84C', icon: '◔' };
}

function selectAdaptiveQuestions(count) {
  const mastery = loadMastery();
  const today = todayISO();
  const allQ = getAvailableQuestions();

  const scored = allQ.map(q => {
    const card = mastery.cards[q.id];
    let priority = 0;
    if (!card) priority = 50;
    else if (card.nextReview <= today) {
      const daysOverdue = Math.floor((new Date(today) - new Date(card.nextReview)) / 86400000);
      priority = 100 + daysOverdue * 10;
    } else {
      priority = 10 + (3.0 - card.ef) * 15;
      if (card.lapses >= 2) priority += 30;
    }
    return { question: q, priority, card };
  });

  scored.sort((a, b) => b.priority - a.priority);

  const maxNew = Math.ceil(count * 0.25);
  let newCount = 0;
  const selected = [];

  for (const item of scored) {
    if (selected.length >= count) break;
    if (!item.card) {
      if (newCount < maxNew) { selected.push(item.question); newCount++; }
    } else {
      selected.push(item.question);
    }
  }

  if (selected.length < count) {
    for (const item of scored) {
      if (selected.length >= count) break;
      if (!selected.includes(item.question)) selected.push(item.question);
    }
  }

  return shuffleArray(selected.slice(0, count));
}

// === 4. UTILITAIRES ===

function filterQuestions(categories) {
  return window.QUESTIONS.filter(q => categories.includes(q.category));
}

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function scoreQuestion(question, userAnswer) {
  return userAnswer === question.correctAnswer ? 1 : 0;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// === 5. NAVIGATION ===

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(id);
  if (target) { target.classList.remove('hidden'); target.scrollTop = 0; }
  window.scrollTo(0, 0);
}

// === 6. PAGE D'ACCUEIL & STATISTIQUES ===

function showHome() {
  if (state.examTimerId) { clearInterval(state.examTimerId); state.examTimerId = null; }
  state.mode = null; state.sessionQuestions = []; state.currentIndex = 0;
  state.userAnswers = []; state.scores = []; state.validated = false; state.lastWrongIds = [];

  renderStats();
  renderAuthStatus();
  renderInstallHint();
  renderFreemiumBar();
  showScreen('home-screen');

  if (isLoggedIn()) syncToServer().catch(() => {});
  if (isPremium()) document.querySelectorAll('.mode-badge-premium').forEach(el => el.style.display = 'none');
}

function renderFreemiumBar() {
  const el = document.getElementById('freemium-bar');
  if (!el) return;
  if (isPremium()) { el.innerHTML = ''; return; }

  const mastery = loadMastery();
  const usedQ = mastery.cards ? Object.keys(mastery.cards).filter(id => FREE_QUESTION_IDS.has(id)).length : 0;
  const pctQ = Math.round(usedQ / FREE_QUESTION_IDS.size * 100);

  el.innerHTML = `
    <div class="freemium-banner">
      <div class="freemium-text">
        <span>Version gratuite — <strong>${usedQ}/${FREE_QUESTION_IDS.size} questions</strong> utilisées</span>
        <a href="${LEMON_SQUEEZY_URL}" target="_blank" class="freemium-upgrade">Accès complet — 49 €</a>
      </div>
      <div class="freemium-progress">
        <div class="freemium-fill" style="width:${pctQ}%"></div>
      </div>
    </div>
  `;
}

function renderStats() {
  const stats = loadStats();
  const errorIds = loadErrors();
  const el = document.getElementById('stats-panel');
  if (!el) return;

  const pct = stats.totalAnswered > 0 ? Math.round((stats.totalCorrect / stats.totalAnswered) * 100) : 0;

  let catHtml = '';
  for (const cat of ALL_CATEGORIES) {
    const d = stats.byCategory ? stats.byCategory[cat] : null;
    if (!d || d.answered === 0) continue;
    const p = Math.round((d.correct / d.answered) * 100);
    catHtml += `
      <div class="stat-row">
        <span class="stat-cat" title="${escapeHtml(cat)}">${escapeHtml(cat)}</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar" style="width:${p}%"></div>
        </div>
        <span class="stat-pct">${p}%</span>
      </div>`;
  }

  const mastery = loadMastery();
  const streak = mastery.stats ? mastery.stats.streakDays : 0;

  el.innerHTML = `
    <div class="stats-summary">
      <div class="stat-item"><span class="stat-val">${stats.totalAnswered}</span><span class="stat-label">Répondues</span></div>
      <div class="stat-item"><span class="stat-val">${pct}%</span><span class="stat-label">Score global</span></div>
      <div class="stat-item"><span class="stat-val">${errorIds.length}</span><span class="stat-label">En erreur</span></div>
      <div class="stat-item"><span class="stat-val">${streak}j</span><span class="stat-label">Série</span></div>
    </div>
    ${catHtml ? `<div class="stat-categories" style="margin:16px 0">${catHtml}</div>` : `<p class="muted" style="margin:12px 0">Aucune session — commencez par le mode Entraînement.</p>`}
    <button class="btn btn-danger btn-sm" onclick="resetAll()">Réinitialiser les statistiques</button>
  `;
}

// === 7. GUIDES ===

function showInfo() { showScreen('info-screen'); }
function showLegal() { showScreen('legal-screen'); }
function showCGV() { showScreen('cgv-screen'); }

// === 8. ÉCRAN DE CONFIGURATION ===

function showConfig(mode) {
  state.mode = mode;
  if (mode === 'error') {
    const errorIds = loadErrors();
    if (errorIds.length === 0) { showScreen('empty-errors-screen'); return; }
  }

  const titles = { train: 'Mode Entraînement', exam: 'Mode Examen Blanc', error: 'Révision des erreurs' };
  document.getElementById('config-title').textContent = titles[mode] || 'Configuration';
  document.getElementById('exam-warning').classList.toggle('hidden', mode !== 'exam');
  document.getElementById('exam-options').classList.toggle('hidden', mode !== 'exam');

  if (mode === 'exam') {
    const r30 = document.getElementById('q-count-30');
    if (r30) r30.checked = true;
  } else {
    const r10 = document.getElementById('q-count-10');
    if (r10) r10.checked = true;
  }
  document.getElementById('custom-count-wrap').classList.add('hidden');
  document.querySelectorAll('[name="category"]').forEach(el => { el.checked = true; });

  // Listener pour le custom count
  const radioGroup = document.querySelectorAll('[name="q-count"]');
  radioGroup.forEach(r => {
    r.onchange = () => {
      document.getElementById('custom-count-wrap').classList.toggle('hidden', r.value !== 'custom' || !r.checked);
    };
  });

  document.getElementById('btn-start-session').onclick = startSession;
  showScreen('config-screen');
}

function toggleAll(type, checked) {
  document.querySelectorAll(`[name="${type}"]`).forEach(el => { el.checked = checked; });
}

function startSession() {
  const categories = [...document.querySelectorAll('[name="category"]:checked')].map(el => el.value);
  if (categories.length === 0) { alert('Veuillez sélectionner au moins un module.'); return; }

  let pool = filterQuestions(categories);
  if (!isPremium()) pool = pool.filter(q => FREE_QUESTION_IDS.has(q.id));
  if (state.mode === 'error') {
    const errorIds = loadErrors();
    pool = pool.filter(q => errorIds.includes(q.id));
  }
  if (pool.length === 0) { alert('Aucune question disponible pour les modules sélectionnés.'); return; }

  let count;
  const countEl = document.querySelector('[name="q-count"]:checked');
  const countVal = countEl ? countEl.value : '10';
  if (countVal === 'custom') {
    count = parseInt(document.getElementById('q-count-custom').value, 10);
    if (!count || count < 1) count = 10;
  } else if (countVal === 'all') {
    count = pool.length;
  } else {
    count = parseInt(countVal, 10);
  }
  count = Math.min(count, pool.length);

  const orderEl = document.querySelector('[name="order"]:checked');
  const order = orderEl ? orderEl.value : 'random';
  let questions = order === 'random' ? shuffleArray(pool) : [...pool];
  questions = questions.slice(0, count);

  state.sessionQuestions = questions;
  state.currentIndex = 0;
  state.userAnswers = new Array(questions.length).fill(null);
  state.scores = new Array(questions.length).fill(null);
  state.answerTimes = new Array(questions.length).fill(null);
  state.validated = false;
  state.examAnswered = state.mode === 'exam' ? new Set() : null;

  if (state.mode === 'exam') {
    const durationInput = document.getElementById('exam-duration');
    const minutes = parseInt(durationInput ? durationInput.value : '60', 10) || 60;
    state.examTimeLeft = minutes * 60;
    startExamTimer();
    initExamNav();
  }

  renderQuestionScreen();
  showScreen('question-screen');
}

function startAdaptiveSession() {
  if (!isPremium()) { showUpgradePrompt('adaptive'); return; }
  state.mode = 'adaptive';
  const questions = selectAdaptiveQuestions(15);
  if (questions.length === 0) { alert('Aucune question disponible.'); return; }

  state.sessionQuestions = questions;
  state.currentIndex = 0;
  state.userAnswers = new Array(questions.length).fill(null);
  state.scores = new Array(questions.length).fill(null);
  state.answerTimes = new Array(questions.length).fill(null);
  state.validated = false;
  state.examAnswered = null;

  renderQuestionScreen();
  showScreen('question-screen');
}

// === 9. ÉCRAN DE QUESTION ===

function renderQuestionScreen() {
  const q = state.sessionQuestions[state.currentIndex];
  const total = state.sessionQuestions.length;
  const idx = state.currentIndex;

  state.questionStartTime = Date.now();

  // Barre de progression
  document.getElementById('q-progress-text').textContent = `${idx + 1} / ${total}`;
  document.getElementById('q-progress-bar').style.width = Math.round((idx / total) * 100) + '%';

  // Chrono
  document.getElementById('exam-timer-wrap').classList.toggle('hidden', state.mode !== 'exam');

  // Méta
  document.getElementById('q-meta').innerHTML = `<span class="tag">${escapeHtml(q.category)}</span>`;

  // Texte de la question
  document.getElementById('q-text').textContent = q.question;

  // Options
  const optArea = document.getElementById('q-options');
  optArea.innerHTML = '';

  // Restaurer la réponse précédente si existante (mode exam navigation)
  const prevAnswer = state.userAnswers[idx];
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.className = 'q-option';
    const letter = document.createElement('span');
    letter.className = 'option-letter';
    letter.textContent = ['A','B','C','D'][i];
    const text = document.createElement('span');
    text.textContent = opt;
    btn.appendChild(letter);
    btn.appendChild(text);
    if (prevAnswer === i) btn.classList.add('selected');
    btn.onclick = () => {
      optArea.querySelectorAll('.q-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      state.userAnswers[idx] = i;
    };
    optArea.appendChild(btn);
  });

  // Feedback
  const feedbackEl = document.getElementById('q-feedback');
  feedbackEl.innerHTML = '';
  feedbackEl.className = 'hidden';

  // Boutons
  document.getElementById('btn-validate').classList.remove('hidden');
  document.getElementById('btn-skip').classList.toggle('hidden', state.mode !== 'exam');
  document.getElementById('btn-next').classList.add('hidden');

  state.validated = false;

  // Actions
  document.getElementById('btn-validate').onclick = validateAnswer;
  document.getElementById('btn-skip').onclick = skipQuestion;

  // Panel de navigation examen
  const navPanel = document.getElementById('exam-nav-panel');
  if (navPanel) navPanel.classList.toggle('hidden', state.mode !== 'exam');
  if (state.mode === 'exam') updateExamNav();
}

function validateAnswer() {
  if (state.validated) return;
  const q = state.sessionQuestions[state.currentIndex];
  const idx = state.currentIndex;
  const answer = state.userAnswers[idx];

  if (answer === null && state.mode !== 'exam') {
    alert('Sélectionnez une réponse avant de valider.');
    return;
  }

  state.validated = true;
  const timeMs = Date.now() - (state.questionStartTime || Date.now());
  state.answerTimes[idx] = timeMs;

  const score = answer !== null ? scoreQuestion(q, answer) : 0;
  state.scores[idx] = score;

  if (state.mode === 'exam' && state.examAnswered) state.examAnswered.add(idx);

  // Mise à jour SM-2 en mode train/adaptive/error
  if (state.mode !== 'exam') {
    const grade = quizScoreToGrade(score, timeMs);
    updateQuestionMastery(q.id, grade);

    // Mise à jour stats
    const stats = loadStats();
    stats.totalAnswered = (stats.totalAnswered || 0) + 1;
    stats.totalCorrect = (stats.totalCorrect || 0) + score;
    if (!stats.byCategory) stats.byCategory = {};
    if (!stats.byCategory[q.category]) stats.byCategory[q.category] = { answered: 0, correct: 0 };
    stats.byCategory[q.category].answered++;
    stats.byCategory[q.category].correct += score;
    saveStats(stats);

    // Pool d'erreurs
    if (score < 1) {
      const errors = loadErrors();
      if (!errors.includes(q.id)) errors.push(q.id);
      saveErrors(errors);
    } else {
      const errors = loadErrors();
      saveErrors(errors.filter(id => id !== q.id));
    }
  }

  // Feedback uniquement en dehors du mode exam
  if (state.mode !== 'exam') {
    const feedbackEl = document.getElementById('q-feedback');
    feedbackEl.className = score === 1 ? 'q-feedback q-feedback-correct' : 'q-feedback q-feedback-wrong';
    feedbackEl.innerHTML = score === 1
      ? `<div class="feedback-icon">✓</div><div class="feedback-text"><strong>Correct !</strong><p class="feedback-explanation">${escapeHtml(q.explanation)}</p></div>`
      : `<div class="feedback-icon">✗</div><div class="feedback-text"><strong>Incorrect.</strong> La bonne réponse est : <em>${escapeHtml(q.options[q.correctAnswer])}</em><p class="feedback-explanation">${escapeHtml(q.explanation)}</p></div>`;

    // Colorer les options
    document.querySelectorAll('.q-option').forEach((btn, i) => {
      if (i === q.correctAnswer) btn.classList.add('correct');
      else if (i === answer && answer !== q.correctAnswer) btn.classList.add('wrong');
    });
  }

  // Boutons
  document.getElementById('btn-validate').classList.add('hidden');
  document.getElementById('btn-skip').classList.add('hidden');

  const btnNext = document.getElementById('btn-next');
  if (idx + 1 < state.sessionQuestions.length) {
    btnNext.textContent = 'Question suivante';
    btnNext.classList.remove('hidden');
    btnNext.onclick = () => {
      state.currentIndex++;
      renderQuestionScreen();
    };
  } else {
    btnNext.textContent = state.mode === 'exam' ? 'Terminer l\'examen' : 'Voir les résultats';
    btnNext.classList.remove('hidden');
    btnNext.onclick = () => finishSession();
  }
}

function skipQuestion() {
  const idx = state.currentIndex;
  state.userAnswers[idx] = null;
  if (state.currentIndex + 1 < state.sessionQuestions.length) {
    state.currentIndex++;
    renderQuestionScreen();
  }
}

// === EXAM TIMER ===

function startExamTimer() {
  if (state.examTimerId) clearInterval(state.examTimerId);
  updateTimerDisplay();
  state.examTimerId = setInterval(() => {
    state.examTimeLeft--;
    updateTimerDisplay();
    if (state.examTimeLeft <= 0) {
      clearInterval(state.examTimerId);
      state.examTimerId = null;
      finishSession();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const el = document.getElementById('exam-timer');
  if (el) {
    el.textContent = formatTime(state.examTimeLeft);
    el.classList.toggle('timer-warning', state.examTimeLeft <= 300);
  }
}

function initExamNav() {
  state.examSkipped = new Set();
}

function updateExamNav() {
  const grid = document.getElementById('exam-nav-grid');
  if (!grid) return;
  const total = state.sessionQuestions.length;
  let html = '';
  for (let i = 0; i < total; i++) {
    const answered = state.userAnswers[i] !== null;
    const current = i === state.currentIndex;
    html += `<button class="exam-nav-btn ${answered ? 'answered' : ''} ${current ? 'current' : ''}" onclick="goToExamQuestion(${i})">${i + 1}</button>`;
  }
  grid.innerHTML = html;

  const badge = document.getElementById('exam-nav-skipped-badge');
  const unanswered = state.sessionQuestions.length - (state.examAnswered ? state.examAnswered.size : 0);
  if (badge) {
    badge.textContent = unanswered;
    badge.classList.toggle('hidden', unanswered === 0);
  }
}

function toggleExamNav() {
  const grid = document.getElementById('exam-nav-grid');
  if (grid) grid.classList.toggle('hidden');
  updateExamNav();
}

function goToExamQuestion(i) {
  if (state.validated) { state.validated = false; }
  state.currentIndex = i;
  renderQuestionScreen();
  const grid = document.getElementById('exam-nav-grid');
  if (grid) grid.classList.add('hidden');
}

// === 10. RÉSULTATS ===

function finishSession() {
  if (state.examTimerId) { clearInterval(state.examTimerId); state.examTimerId = null; }

  const questions = state.sessionQuestions;
  const answers = state.userAnswers;
  const scores = state.scores;

  // Calculer les scores finaux (mode exam : les réponses non validées doivent être scorées)
  let totalScore = 0;
  let totalAnswered = 0;
  const wrongIds = [];

  questions.forEach((q, i) => {
    let sc = scores[i];
    if (sc === null) {
      // Non validée : scorer maintenant
      sc = answers[i] !== null ? scoreQuestion(q, answers[i]) : 0;
      scores[i] = sc;
    }
    totalScore += sc;
    totalAnswered++;
    if (sc < 1) wrongIds.push(q.id);
  });

  state.lastWrongIds = wrongIds;

  // Mode exam : mettre à jour stats et erreurs pour toutes les questions
  if (state.mode === 'exam') {
    const stats = loadStats();
    if (!stats.byCategory) stats.byCategory = {};
    questions.forEach((q, i) => {
      const sc = scores[i] || 0;
      const timeMs = state.answerTimes[i] || 10000;
      const grade = quizScoreToGrade(sc, timeMs);
      updateQuestionMastery(q.id, grade);

      stats.totalAnswered = (stats.totalAnswered || 0) + 1;
      stats.totalCorrect = (stats.totalCorrect || 0) + sc;
      if (!stats.byCategory[q.category]) stats.byCategory[q.category] = { answered: 0, correct: 0 };
      stats.byCategory[q.category].answered++;
      stats.byCategory[q.category].correct += sc;
    });
    saveStats(stats);

    const errors = loadErrors();
    const errorsSet = new Set(errors);
    wrongIds.forEach(id => errorsSet.add(id));
    questions.filter((q, i) => scores[i] === 1).forEach(q => errorsSet.delete(q.id));
    saveErrors([...errorsSet]);
  }

  // Sauvegarder la session
  const session = {
    date: new Date().toISOString(),
    mode: state.mode,
    total: questions.length,
    correct: totalScore,
    pct: Math.round((totalScore / questions.length) * 100)
  };
  const sessions = loadSessions();
  sessions.push(session);
  saveSessions(sessions);

  // Afficher les résultats
  const pct = Math.round((totalScore / questions.length) * 100);
  const passed = pct >= 60;

  let resultHtml = `
    <div class="result-score ${passed ? 'result-pass' : 'result-fail'}">
      <div class="result-score-num">${pct}%</div>
      <div class="result-score-label">${passed ? '✓ Seuil de 60% atteint' : '✗ En dessous du seuil de 60%'}</div>
    </div>
    <div class="result-stats">
      <div class="result-stat"><span class="result-stat-val">${totalScore}/${questions.length}</span><span class="result-stat-label">Bonnes réponses</span></div>
      <div class="result-stat"><span class="result-stat-val">${wrongIds.length}</span><span class="result-stat-label">Erreurs</span></div>
    </div>
  `;

  // Résultats par module
  const byCat = {};
  questions.forEach((q, i) => {
    if (!byCat[q.category]) byCat[q.category] = { total: 0, correct: 0 };
    byCat[q.category].total++;
    byCat[q.category].correct += scores[i] || 0;
  });
  let catHtml = '';
  for (const cat in byCat) {
    const d = byCat[cat];
    const p = Math.round((d.correct / d.total) * 100);
    catHtml += `
      <div class="stat-row">
        <span class="stat-cat">${escapeHtml(cat)}</span>
        <div class="stat-bar-wrap"><div class="stat-bar" style="width:${p}%"></div></div>
        <span class="stat-pct">${d.correct}/${d.total}</span>
      </div>`;
  }
  if (catHtml) resultHtml += `<div class="result-section"><h3>Par module</h3><div class="stat-categories">${catHtml}</div></div>`;

  // Revue des erreurs
  if (wrongIds.length > 0 && state.mode !== 'exam') {
    let reviewHtml = `<div class="result-section"><h3>Questions à retravailler</h3>`;
    questions.forEach((q, i) => {
      if (scores[i] < 1) {
        reviewHtml += `
          <div class="review-item">
            <div class="review-question">${escapeHtml(q.question)}</div>
            <div class="review-answer">Votre réponse : ${answers[i] !== null ? escapeHtml(q.options[answers[i]]) : '<em>Sans réponse</em>'}</div>
            <div class="review-correct">Bonne réponse : ${escapeHtml(q.options[q.correctAnswer])}</div>
            <div class="review-explanation">${escapeHtml(q.explanation)}</div>
          </div>`;
      }
    });
    reviewHtml += '</div>';
    resultHtml += reviewHtml;
  }

  // Boutons d'action
  resultHtml += `
    <div class="result-actions">
      ${wrongIds.length > 0 ? `<button class="btn btn-primary" onclick="showConfig('error')">Retravailler les erreurs</button>` : ''}
      <button class="btn btn-secondary" onclick="showConfig('train')">Nouvelle session</button>
      <button class="btn btn-secondary" onclick="showHome()">Retour à l'accueil</button>
    </div>
  `;

  document.getElementById('result-content').innerHTML = resultHtml;
  showScreen('result-screen');
}

// === 11. FLASHCARDS ===

function showFlashcardConfig() {
  const container = document.getElementById('fc-config-content');
  if (!container) return;

  const allFc = getAvailableFlashcards();
  const byCat = {};
  allFc.forEach(fc => {
    if (!byCat[fc.category]) byCat[fc.category] = 0;
    byCat[fc.category]++;
  });

  const fcMastery = loadFcMastery();

  let catHtml = '';
  for (const cat of ALL_CATEGORIES) {
    const count = byCat[cat] || 0;
    if (count === 0) continue;
    const fcInCat = allFc.filter(fc => fc.category === cat);
    const masteredCount = fcInCat.filter(fc => {
      const card = fcMastery.cards[fc.id];
      return card && masteryLevel(card) >= 75;
    }).length;
    catHtml += `
      <label class="checkbox-label">
        <input type="checkbox" name="fc-category" value="${escapeHtml(cat)}" checked>
        ${escapeHtml(cat)} <span class="muted" style="font-size:11px">(${masteredCount}/${count} maîtrisées)</span>
      </label>`;
  }

  container.innerHTML = `
    <div class="config-section">
      <h3>Modules</h3>
      <div style="display:flex;gap:12px;margin-bottom:8px">
        <button class="config-select-all" onclick="toggleAllFc(true)">Tout cocher</button>
        <button class="config-select-all" onclick="toggleAllFc(false)">Tout décocher</button>
      </div>
      <div class="checkbox-grid">${catHtml}</div>
    </div>
    <div class="config-section">
      <h3>Nombre de cartes</h3>
      <div class="radio-group">
        <label class="radio-label"><input type="radio" name="fc-count" value="10"> 10</label>
        <label class="radio-label"><input type="radio" name="fc-count" value="15" checked> 15</label>
        <label class="radio-label"><input type="radio" name="fc-count" value="25"> 25</label>
        <label class="radio-label"><input type="radio" name="fc-count" value="all"> Toutes</label>
      </div>
    </div>
    <div class="config-section">
      <h3>Mode</h3>
      <div class="radio-group">
        <label class="radio-label"><input type="radio" name="fc-mode" value="random" checked> Aléatoire</label>
        <label class="radio-label"><input type="radio" name="fc-mode" value="due"> Cartes dues (SM-2)</label>
        <label class="radio-label"><input type="radio" name="fc-mode" value="weak"> Cartes faibles</label>
      </div>
    </div>
    <button class="btn btn-primary" onclick="startFlashcards()" style="width:100%;margin-top:8px;padding:14px">Lancer les flashcards</button>
  `;

  showScreen('fc-config-screen');
}

function toggleAllFc(checked) {
  document.querySelectorAll('[name="fc-category"]').forEach(el => { el.checked = checked; });
}

function startFlashcards() {
  const categories = [...document.querySelectorAll('[name="fc-category"]:checked')].map(el => el.value);
  if (categories.length === 0) { alert('Sélectionnez au moins un module.'); return; }

  let pool = getAvailableFlashcards().filter(fc => categories.includes(fc.category));
  if (pool.length === 0) { alert('Aucune flashcard disponible.'); return; }

  const modeEl = document.querySelector('[name="fc-mode"]:checked');
  const mode = modeEl ? modeEl.value : 'random';

  const fcMastery = loadFcMastery();
  const today = todayISO();

  if (mode === 'due') {
    pool = pool.filter(fc => {
      const card = fcMastery.cards[fc.id];
      return !card || card.nextReview <= today;
    });
    if (pool.length === 0) { alert('Aucune flashcard due aujourd\'hui — toutes à jour !'); return; }
  } else if (mode === 'weak') {
    pool.sort((a, b) => masteryLevel(fcMastery.cards[a.id]) - masteryLevel(fcMastery.cards[b.id]));
  } else {
    pool = shuffleArray(pool);
  }

  const countEl = document.querySelector('[name="fc-count"]:checked');
  const countVal = countEl ? countEl.value : '15';
  const count = countVal === 'all' ? pool.length : Math.min(parseInt(countVal, 10), pool.length);

  state.fcSession = pool.slice(0, count);
  state.fcIndex = 0;
  state.fcFlipped = false;
  state.fcResults = [];

  renderFlashcard();
  showScreen('flashcard-screen');
}

function renderFlashcard() {
  const fc = state.fcSession[state.fcIndex];
  if (!fc) return;
  const total = state.fcSession.length;
  const idx = state.fcIndex;

  // Progression
  const pct = Math.round((idx / total) * 100);
  document.getElementById('fc-progress-fill').style.width = pct + '%';
  document.getElementById('fc-progress-text').textContent = `${idx + 1} / ${total}`;

  // Badge catégorie
  document.getElementById('fc-category-badge').textContent = fc.category;

  // Carte
  const frontEl = document.querySelector('.fc-card-front .fc-question');
  const backEl = document.querySelector('.fc-card-back .fc-answer');
  if (frontEl) frontEl.textContent = fc.front;
  if (backEl) backEl.textContent = fc.back;

  // Reset flip
  const card = document.getElementById('fc-card');
  if (card) { card.classList.remove('flipped'); }
  state.fcFlipped = false;

  document.getElementById('fc-flip-hint').classList.remove('hidden');
  document.getElementById('fc-buttons').classList.add('hidden');

  // Indicateur de maîtrise
  const fcMastery = loadFcMastery();
  const masteryCard = fcMastery.cards[fc.id];
  const label = masteryLabel(masteryCard);
  const masteryEl = document.getElementById('fc-mastery-indicator');
  if (masteryEl) masteryEl.innerHTML = `<span style="color:${label.color}">${label.icon} ${label.text}</span>`;

  // Afficher les intervalles SM-2 sur les boutons
  ['1','3','4','5'].forEach(g => {
    const el = document.getElementById('fc-interval-' + g);
    if (el) {
      const simCard = sm2Update(masteryCard ? {...masteryCard, history: [...(masteryCard.history || [])]} : null, parseInt(g));
      el.textContent = simCard.interval === 1 ? '1j' : simCard.interval + 'j';
    }
  });
}

function flipFlashcard() {
  const card = document.getElementById('fc-card');
  if (!card) return;
  if (!state.fcFlipped) {
    card.classList.add('flipped');
    state.fcFlipped = true;
    document.getElementById('fc-flip-hint').classList.add('hidden');
    document.getElementById('fc-buttons').classList.remove('hidden');
  }
}

function rateFlashcard(grade) {
  const fc = state.fcSession[state.fcIndex];
  if (!fc) return;

  updateFlashcardMastery(fc.id, grade);
  state.fcResults.push({ id: fc.id, grade });

  if (state.fcIndex + 1 < state.fcSession.length) {
    state.fcIndex++;
    renderFlashcard();
  } else {
    showFlashcardResults();
  }
}

function showFlashcardResults() {
  const total = state.fcResults.length;
  const good = state.fcResults.filter(r => r.grade >= 4).length;
  const pct = Math.round((good / total) * 100);

  const labels = { 1: 'Mauvais', 3: 'Ok', 4: 'Bon', 5: 'Parfait' };
  let distHtml = '';
  [1,3,4,5].forEach(g => {
    const count = state.fcResults.filter(r => r.grade === g).length;
    distHtml += `<div class="fc-result-dist"><span class="fc-result-grade-label">${labels[g]}</span><span class="fc-result-grade-count">${count}</span></div>`;
  });

  document.getElementById('fc-results-content').innerHTML = `
    <div class="result-score ${pct >= 60 ? 'result-pass' : 'result-fail'}">
      <div class="result-score-num">${pct}%</div>
      <div class="result-score-label">Bonnes réponses (Bon + Parfait)</div>
    </div>
    <div class="result-stats">
      <div class="result-stat"><span class="result-stat-val">${total}</span><span class="result-stat-label">Cartes révisées</span></div>
      <div class="result-stat"><span class="result-stat-val">${good}</span><span class="result-stat-label">Bien maîtrisées</span></div>
    </div>
    <div class="fc-results-dist">${distHtml}</div>
    <div class="result-actions">
      <button class="btn btn-primary" onclick="showFlashcardConfig()">Nouvelle session</button>
      <button class="btn btn-secondary" onclick="showHome()">Retour à l'accueil</button>
    </div>
  `;
  showScreen('fc-results-screen');
}

// Espace / clavier pour retourner la carte
document.addEventListener('keydown', e => {
  const fcScreen = document.getElementById('flashcard-screen');
  if (fcScreen && !fcScreen.classList.contains('hidden')) {
    if (e.code === 'Space') { e.preventDefault(); flipFlashcard(); }
    if (e.code === 'Digit1' || e.code === 'Numpad1') rateFlashcard(1);
    if (e.code === 'Digit2' || e.code === 'Numpad2') rateFlashcard(3);
    if (e.code === 'Digit3' || e.code === 'Numpad3') rateFlashcard(4);
    if (e.code === 'Digit4' || e.code === 'Numpad4') rateFlashcard(5);
  }
});

// === 12. CARTE DE CONNAISSANCES ===

function showKnowledgeMap() {
  if (!isPremium()) { showUpgradePrompt('knowledge'); return; }

  const mastery = loadMastery();
  const fcMastery = loadFcMastery();
  const allQ = window.QUESTIONS;
  const allFc = window.FLASHCARDS;

  // Résumé global
  const totalQ = allQ.length;
  const seenQ = Object.keys(mastery.cards).length;
  const masteredQ = Object.keys(mastery.cards).filter(id => masteryLevel(mastery.cards[id]) >= 75).length;

  document.getElementById('km-summary').innerHTML = `
    <div class="km-global">
      <div class="km-stat"><span class="km-stat-val">${masteredQ}</span><span class="km-stat-label">Questions maîtrisées</span></div>
      <div class="km-stat"><span class="km-stat-val">${seenQ}</span><span class="km-stat-label">Questions vues</span></div>
      <div class="km-stat"><span class="km-stat-val">${totalQ - seenQ}</span><span class="km-stat-label">Non vues</span></div>
    </div>
  `;

  // Par module
  let gridHtml = '';
  for (const cat of ALL_CATEGORIES) {
    const catQ = allQ.filter(q => q.category === cat);
    const catFc = allFc.filter(fc => fc.category === cat);
    const seenCatQ = catQ.filter(q => mastery.cards[q.id]).length;
    const masteredCatQ = catQ.filter(q => mastery.cards[q.id] && masteryLevel(mastery.cards[q.id]) >= 75).length;
    const masteredCatFc = catFc.filter(fc => fcMastery.cards[fc.id] && masteryLevel(fcMastery.cards[fc.id]) >= 75).length;
    const pct = catQ.length > 0 ? Math.round((masteredCatQ / catQ.length) * 100) : 0;

    gridHtml += `
      <div class="km-card">
        <div class="km-card-title">${escapeHtml(cat)}</div>
        <div class="km-card-bar-wrap"><div class="km-card-bar" style="width:${pct}%"></div></div>
        <div class="km-card-stats">
          <span>${masteredCatQ}/${catQ.length} QCM maîtrisés</span>
          <span>${masteredCatFc}/${catFc.length} flashcards</span>
        </div>
      </div>`;
  }

  document.getElementById('km-grid').innerHTML = gridHtml;
  showScreen('knowledge-screen');
}

// === 13. PWA INSTALLATION ===

let _deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  _deferredInstallPrompt = e;
  renderInstallHint();
});

function installPWA() {
  if (_deferredInstallPrompt) {
    _deferredInstallPrompt.prompt();
    _deferredInstallPrompt.userChoice.then(() => { _deferredInstallPrompt = null; renderInstallHint(); });
  }
}

function renderInstallHint() {
  const hint = document.getElementById('home-install-hint');
  const btn = document.getElementById('home-install-btn');
  if (!hint || !btn) return;

  const isStandalone = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

  if (isStandalone) { hint.classList.add('hidden'); return; }
  if (_deferredInstallPrompt) {
    hint.classList.remove('hidden');
    btn.textContent = '📲 Installer l\'app sur cet appareil';
    btn.onclick = installPWA;
  } else if (isIOS) {
    hint.classList.remove('hidden');
    btn.textContent = '📲 Sur iOS : Partager → Sur l\'écran d\'accueil';
    btn.onclick = null;
  } else {
    hint.classList.add('hidden');
  }
}

// === 14. SERVICE WORKER ===

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// === 15. INITIALISATION ===

document.addEventListener('DOMContentLoaded', () => {
  // Vérifier si URL de reset password
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('reset');
  const resetEmail = params.get('email');
  if (resetToken && resetEmail) {
    showResetPasswordForm(resetEmail, resetToken);
    return;
  }

  showHome();
});

function showResetPasswordForm(email, token) {
  const safeEmail = escapeHtml(email);
  document.body.innerHTML = `
    <div style="max-width:400px;margin:60px auto;padding:24px;font-family:system-ui,sans-serif">
      <h2 style="text-align:center;color:#1E3A5F">Nouveau mot de passe</h2>
      <p style="color:#64748b;text-align:center;font-size:14px">Pour : ${safeEmail}</p>
      <input type="password" id="reset-pw" placeholder="Nouveau mot de passe (min 6 car.)" style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;box-sizing:border-box">
      <input type="password" id="reset-pw2" placeholder="Confirmer" style="width:100%;padding:10px;margin-bottom:16px;border:1px solid #e2e8f0;border-radius:6px;font-size:14px;box-sizing:border-box">
      <button onclick="submitResetPassword('${escapeHtml(email)}', '${escapeHtml(token)}')" style="width:100%;padding:12px;background:#1E3A5F;color:white;border:none;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer">Changer le mot de passe</button>
      <p id="reset-error" style="color:#dc2626;text-align:center;margin-top:12px;display:none"></p>
    </div>`;
}

async function submitResetPassword(email, token) {
  const pw = document.getElementById('reset-pw').value;
  const pw2 = document.getElementById('reset-pw2').value;
  const errEl = document.getElementById('reset-error');
  if (pw.length < 6) { errEl.textContent = 'Mot de passe trop court (min 6).'; errEl.style.display = 'block'; return; }
  if (pw !== pw2) { errEl.textContent = 'Les mots de passe ne correspondent pas.'; errEl.style.display = 'block'; return; }
  const result = await apiCall('/api/reset-password', 'POST', { email, token, newPassword: pw });
  if (result.success) {
    alert('Mot de passe changé ! Vous pouvez vous connecter.');
    window.location.href = window.location.origin + window.location.pathname;
  } else {
    errEl.textContent = result.error || 'Lien expiré ou invalide. Redemandez un reset.';
    errEl.style.display = 'block';
  }
}
