/* =====================================================================
   WESHAH — الأدوات الخفيفة (بدون Firebase): الثيم، الجلسة، الأيقونات،
   التنبيهات، النوافذ، تثبيت التطبيق، الهوية المخزنة محليًا
   ===================================================================== */

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** يمنع روابط javascript: وما شابهها */
export function safeHref(h) {
  h = String(h ?? '').trim();
  if (!h) return '#';
  if (/^(javascript|data|vbscript):/i.test(h.replace(/[\s\u0000-\u001f]/g, ''))) return '#';
  return h;
}

export const LOGO_FALLBACK = 'https://i.ibb.co/kgKm56XB/file-00000000090c820a908068c98bfae1f9.webp';

/* ---------- الأيقونات ---------- */
export const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5M12 22V12"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  truck: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  store: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
  heart: '<path d="M20.8 8.8c0 5.2-8.8 11-8.8 11s-8.8-5.8-8.8-11A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.8 2.8Z"/>',
  bell: '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  tag: '<path d="M20.59 13.41 12 22l-9-9V3h10l7.59 7.59a2 2 0 0 1 0 2.82Z"/><circle cx="7" cy="7" r="1"/>',
  chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
  wallet: '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4Z"/>',
  home: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z"/>',
  coins: '<circle cx="9" cy="9" r="7"/><path d="M15.5 9.3A7 7 0 1 1 9.3 15.5"/><path d="M9 6v6M7 8.5c0-.8.9-1.5 2-1.5s2 .7 2 1.5-.9 1.5-2 1.5-2 .7-2 1.5.9 1.5 2 1.5 2-.7 2-1.5"/>',
  receipt: '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 .7V2l-1 .7-3-2-3 2-3-2-3 2z"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  percent: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  trending: '<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v9H5v-9M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6"/>',
  up: '<path d="m18 15-6-6-6 6"/>',
  down: '<path d="m6 9 6 6 6-6"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeoff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><path d="m1 1 22 22"/>',
  undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  refresh: '<path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5M3 12a9 9 0 0 0 15 6.7L21 16"/><path d="M16 16h5v5"/>',
  alert: '<path d="m10.3 3.9-8.5 14.7A2 2 0 0 0 3.5 21.6h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  moon: '<path d="M20.5 15.2A8.5 8.5 0 0 1 8.8 3.5 8.7 8.7 0 1 0 20.5 15.2Z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>',
  install: '<rect x="5" y="2" width="14" height="20" rx="3"/><path d="M12 7v7m-3-3 3 3 3-3M10 18h4"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  lock: '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.2 3.6-7 8-7s8 2.8 8 7"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
  calc: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h.01M16 19h.01"/>'
};
export const svg = (name, cls = '') =>
  `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.link}</svg>`;

/* ألوان الأزرار */
export const COLORS = {
  green: 'linear-gradient(145deg,#0b4a33,#05291e)',
  gold: 'linear-gradient(145deg,#c9a45c,#a07a2a)',
  forest: 'linear-gradient(145deg,#15543d,#0b4a33)',
  dark: 'linear-gradient(145deg,#2b443a,#122b25)',
  red: 'linear-gradient(145deg,#c96b5d,#9c4338)',
  blue: 'linear-gradient(145deg,#3f78a8,#274f73)',
  purple: 'linear-gradient(145deg,#7d5ba6,#523876)'
};

/* ---------- الثيم ---------- */
export function currentTheme() { return document.body.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
export function initTheme() {
  let saved = 'light';
  try { saved = localStorage.getItem('weshah-theme') || 'light'; } catch (_) {}
  document.body.setAttribute('data-theme', saved === 'dark' ? 'dark' : 'light');
  syncThemeUI();
}
export function toggleTheme() {
  const next = currentTheme() === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  try { localStorage.setItem('weshah-theme', next); } catch (_) {}
  syncThemeUI();
}
function syncThemeUI() {
  const dark = currentTheme() === 'dark';
  $$('.js-theme-icon').forEach(el => { el.innerHTML = ICONS[dark ? 'sun' : 'moon']; });
  const meta = $('meta[name="theme-color"]');
  if (meta) meta.content = dark ? '#0a2c20' : '#073b29';
}
window.toggleTheme = toggleTheme;

/* ---------- الجلسة ---------- */
const SESSION_KEY = 'weshah_admin_session';
export function getSession() {
  for (const store of [localStorage, sessionStorage]) {
    try {
      const raw = store.getItem(SESSION_KEY);
      if (!raw) continue;
      const s = JSON.parse(raw);
      if (s && s.user && (!s.exp || s.exp > Date.now())) return s;
      store.removeItem(SESSION_KEY);
    } catch (_) {}
  }
  return null;
}
export function setSession(user, remember) {
  const ttl = remember ? 30 * 864e5 : 12 * 36e5;
  const data = { user, time: Date.now(), exp: Date.now() + ttl, remember: !!remember };
  clearSession();
  (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, JSON.stringify(data));
  return data;
}
export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
}
export function requireAuth() {
  const s = getSession();
  if (!s) { window.location.replace('login.html'); throw new Error('Not authenticated'); }
  return s;
}
export async function logout() {try{await fetch('/api/push?action=logout',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'same-origin',cache:'no-store'});}catch{}finally{clearSession();window.location.href='login.html';}}
window.logout = logout;

/* ---------- SHA-256 ---------- */
export async function sha256Hex(str) {
  if (globalThis.crypto && crypto.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return sha256Fallback(str);
}
function sha256Fallback(ascii) {
  const rr = (v, a) => (v >>> a) | (v << (32 - a));
  const bytes = [...new TextEncoder().encode(ascii)];
  const K = [], H = [];
  let p = 0;
  const isPrime = n => { for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
  for (let c = 2; p < 64; c++) if (isPrime(c)) {
    K[p] = (Math.pow(c, 1 / 3) * 4294967296) | 0;
    if (p < 8) H[p] = (Math.pow(c, 1 / 2) * 4294967296) | 0;
    p++;
  }
  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (bitLen >>> (i * 8)) & 255);
  for (let off = 0; off < bytes.length; off += 64) {
    const w = [];
    for (let i = 0; i < 16; i++) w[i] = (bytes[off + 4 * i] << 24) | (bytes[off + 4 * i + 1] << 16) | (bytes[off + 4 * i + 2] << 8) | bytes[off + 4 * i + 3];
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rr(e, 6) ^ rr(e, 11) ^ rr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0;
      const t2 = ((rr(a, 2) ^ rr(a, 13) ^ rr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
}

/* ---------- التنبيهات ---------- */
let toastTimer;
export function toast(msg, type = 'ok') {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show ' + (type === 'error' ? 'error' : type === 'warn' ? 'warn' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), type === 'error' ? 5000 : 2800);
}
window.showToast = (m, isErr) => toast(m, isErr ? 'error' : 'ok');

/* ---------- النوافذ ---------- */
export function openModal({ title, body, saveLabel = 'حفظ', cancelLabel = 'إلغاء', onSave, danger = false, wide = false, hideSave = false }) {
  closeModal();
  const m = document.createElement('div');
  m.className = 'modal show';
  m.id = 'appModal';
  m.innerHTML = `
    <div class="modal-box ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <button class="modal-close" type="button" aria-label="إغلاق">${svg('x')}</button>
      <h3>${esc(title)}</h3>
      <div class="modal-body">${body}</div>
      <div class="modal-actions">
        ${hideSave ? '' : `<button class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" type="button" data-save>${esc(saveLabel)}</button>`}
        <button class="btn btn-secondary" type="button" data-cancel>${esc(cancelLabel)}</button>
      </div>
    </div>`;
  document.body.appendChild(m);
  document.body.classList.add('modal-open');
  const box = $('.modal-box', m);
  const close = () => closeModal();
  m.addEventListener('mousedown', e => { if (e.target === m) close(); });
  $('.modal-close', m).onclick = close;
  $('[data-cancel]', m).onclick = close;
  const save = $('[data-save]', m);
  if (save) save.onclick = async () => {
    if (!onSave) return close();
    save.disabled = true;
    try { const r = await onSave(box); if (r !== false) close(); }
    catch (err) { console.error(err); toast(err.message || 'حدث خطأ', 'error'); }
    finally { save.disabled = false; }
  };
  m.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  const first = $('input:not([type=hidden]),select,textarea', box);
  if (first) setTimeout(() => first.focus(), 30);
  return box;
}
export function closeModal() {
  const m = $('#appModal');
  if (m) m.remove();
  document.body.classList.remove('modal-open');
}
export function confirmDialog(message, { title = 'تأكيد', okLabel = 'تأكيد', danger = true } = {}) {
  return new Promise(res => {
    let done = false;
    const finish = v => { if (!done) { done = true; res(v); } };
    openModal({
      title, body: `<p class="confirm-msg">${esc(message)}</p>`, saveLabel: okLabel, danger,
      onSave: () => { finish(true); }
    });
    const m = $('#appModal');
    const obs = new MutationObserver(() => { if (!document.body.contains(m)) { obs.disconnect(); finish(false); } });
    obs.observe(document.body, { childList: true });
  });
}

/* ---------- تطبيق الهاتف (PWA) ---------- */
let deferredPrompt = null;
export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  navigator.serviceWorker.register('sw.js').catch(e => console.warn('SW registration failed', e));
}

window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  $$('.js-install').forEach(b => b.hidden = false);
  document.dispatchEvent(new CustomEvent('weshah:installable'));
});
window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  $$('.js-install').forEach(b => b.hidden = true);
  toast('✓ تم تثبيت التطبيق');
});
export const canInstall = () => !!deferredPrompt;
export async function installApp() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => {});
    deferredPrompt = null;
    $$('.js-install').forEach(b => b.hidden = true);
    return;
  }
  if (isStandalone()) return toast('التطبيق مثبّت بالفعل');
  if (isIOS()) {
    openModal({
      title: 'تثبيت التطبيق على الآيفون',
      body: `<ol class="steps"><li>افتح الموقع من متصفح <b>Safari</b>.</li><li>اضغط زر المشاركة <b>⎋</b> أسفل الشاشة.</li><li>اختر <b>إضافة إلى الشاشة الرئيسية</b>.</li></ol>`,
      hideSave: true, cancelLabel: 'حسنًا'
    });
  } else {
    openModal({
      title: 'تثبيت التطبيق',
      body: `<p class="confirm-msg">افتح قائمة المتصفح (⋮) ثم اختر <b>تثبيت التطبيق</b> أو <b>إضافة إلى الشاشة الرئيسية</b>.<br><small>التثبيت يحتاج أن يكون الموقع على رابط HTTPS.</small></p>`,
      hideSave: true, cancelLabel: 'حسنًا'
    });
  }
}
window.installApp = installApp;

/* ---------- الهوية المخزنة محليًا (تظهر فورًا قبل Firebase) ---------- */
const CFG_KEY = 'weshah-cfg';
const LOGO_KEY = 'weshah-logo';
export function readCachedConfig() { try { return JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (_) { return null; } }
export function writeCachedConfig(cfg) { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (_) {} }
export function readCachedLogo() { try { return JSON.parse(localStorage.getItem(LOGO_KEY) || 'null'); } catch (_) { return null; } }
export function writeCachedLogo(id, data) { try { localStorage.setItem(LOGO_KEY, JSON.stringify({ id, data })); } catch (_) {} }

export function paintBrand(cfg, logoSrc) {
  const src = logoSrc || LOGO_FALLBACK;
  $$('.js-logo').forEach(img => { if (img.getAttribute('src') !== src) img.src = src; });
  const nameEn = (cfg && cfg.siteNameEn) || 'WESHAH';
  $$('.js-name').forEach(el => { el.textContent = nameEn; });
  let fav = $('link[rel="icon"]');
  if (!fav) { fav = document.createElement('link'); fav.rel = 'icon'; document.head.appendChild(fav); }
  if (src.startsWith('data:')) fav.href = src;
}

export function paintBrandFromCache() {
  const cfg = readCachedConfig();
  const cached = readCachedLogo();
  let src = null;
  if (cfg && cfg.logoImageId && cached && cached.id === cfg.logoImageId) src = cached.data;
  else if (cfg && cfg.logoUrl) src = cfg.logoUrl;
  paintBrand(cfg, src);
  return cfg;
}

/* ---------- عام ---------- */
export function debounce(fn, ms = 200) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
export function download(filename, content, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
