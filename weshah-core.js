/* =====================================================================
   WESHAH — النواة: Firebase Firestore فقط (بدون Storage)
   · الصور تُضغط بقوة ثم تُحفظ مقسّمة على عدة مستندات عادية
   · الإعدادات والأزرار والهوية في مستند settings/site
   · هيكل الصفحة (الشريط الجانبي، شريط التنقل السفلي، الثيم، التثبيت)
   ===================================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, addDoc,
  query, orderBy, where, onSnapshot, serverTimestamp, Timestamp, runTransaction, increment
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {getDoc,getDocs,updateDoc,deleteDoc,writeBatch} from './private-data.js';
import {
  $, $$, esc, svg, safeHref, COLORS, LOGO_FALLBACK, toast,
  initTheme, toggleTheme, registerSW, isStandalone, installApp, canInstall,
  readCachedConfig, writeCachedConfig, readCachedLogo, writeCachedLogo,
  paintBrand, paintBrandFromCache, requireAuth, logout
} from "./weshah-lite.js";

export * from "./weshah-lite.js";
export { collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, writeBatch, query, orderBy, where, onSnapshot, serverTimestamp, Timestamp, runTransaction, increment };

/* ================= Firebase ================= */
const firebaseConfig = {
  apiKey: "AIzaSyDx4qDjTvWkzfX2H3SwuVMJe3a-wcr5xhk",
  authDomain: "matrgar-bf3d1.firebaseapp.com",
  projectId: "matrgar-bf3d1",
  storageBucket: "matrgar-bf3d1.firebasestorage.app",
  messagingSenderId: "195064511513",
  appId: "1:195064511513:web:6b3a83ee0391b70199fe88",
  measurementId: "G-VCWVL38B8F"
};
export const app = initializeApp(firebaseConfig);
export let db;
try {
  // ذاكرة محلية دائمة: التطبيق يفتح ببيانات آخر مرة حتى مع ضعف الاتصال
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (_) {
  db = getFirestore(app);
}

/* ================= الصور: ضغط شديد + تخزين في عدة مستندات ================= */
const IMG_COL = 'images';            // مستند وصفي لكل صورة
const CHUNK_COL = 'image_chunks';    // أجزاء base64 (كل جزء مستند مستقل)
const CHUNK_SIZE = 30000;            // حرف لكل مستند (أقل بكثير من حد 1MB)

function loadBitmap(file) {
  return new Promise(async (resolve, reject) => {
    try {
      if (window.createImageBitmap && file.type !== 'image/svg+xml') return resolve(await createImageBitmap(file));
    } catch (_) { /* نكمل بالطريقة البديلة */ }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذّرت قراءة الصورة')); };
    img.src = url;
  });
}

/**
 * يضغط الصورة بقوة: يصغّر الأبعاد ويخفض الجودة تدريجيًا حتى يصل للحجم المستهدف.
 * الشعارات الشفافة تبقى شفافة (WebP/PNG)، والصور العادية تُحفظ WebP/JPEG.
 */
export async function compressImage(file, { maxDim = 640, targetBytes = 45000, minDim = 96, keepAlpha = true } = {}) {
  if (!file || !/^image\//.test(file.type)) throw new Error('الملف المختار ليس صورة');
  const bmp = await loadBitmap(file);
  const srcW = bmp.width || 512, srcH = bmp.height || 512;
  let scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  let w = Math.max(1, Math.round(srcW * scale)), h = Math.max(1, Math.round(srcH * scale));
  const alpha = keepAlpha && /png|webp|svg|gif/.test(file.type);
  const qualities = [0.72, 0.58, 0.45, 0.34, 0.25, 0.18];
  let best = null;

  for (let round = 0; round < 12; round++) {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!alpha) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h); }
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bmp, 0, 0, w, h);

    for (const q of qualities) {
      let mime = 'image/webp';
      let data = canvas.toDataURL(mime, q);
      if (!data.startsWith('data:image/webp')) {              // Safari لا يدعم ترميز WebP
        if (alpha) { data = canvas.toDataURL('image/png'); mime = 'image/png'; }
        else { data = canvas.toDataURL('image/jpeg', q); mime = 'image/jpeg'; }
      }
      const bytes = Math.round((data.length - data.indexOf(',') - 1) * 0.75);
      if (!best || bytes < best.bytes) best = { dataUrl: data, bytes, width: w, height: h, mime };
      if (bytes <= targetBytes) return { ...best, originalBytes: file.size };
      if (mime === 'image/png') break;                          // PNG لا يتأثر بالجودة، نصغّر الأبعاد
    }
    const nw = Math.round(w * 0.82), nh = Math.round(h * 0.82);
    if (Math.max(nw, nh) < minDim) break;
    w = nw; h = nh;
  }
  if (bmp.close) try { bmp.close(); } catch (_) {}
  return { ...best, originalBytes: file.size };
}

const imgCache = new Map();

/** يحفظ صورة (data URL) موزّعة على عدة مستندات، ويرجع المعرّف */
export async function saveImage(dataUrl, { kind = 'image', name = '', width = 0, height = 0 } = {}) {
  const m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl || '');
  if (!m) throw new Error('صيغة الصورة غير صالحة');
  const [, mime, b64] = m;
  const n = Math.ceil(b64.length / CHUNK_SIZE);
  if (n > 400) throw new Error('الصورة كبيرة جدًا حتى بعد الضغط');
  const id = 'img_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const batch = writeBatch(db);
  batch.set(doc(db, IMG_COL, id), { kind, name: String(name).slice(0, 120), mime, chunks: n, length: b64.length, width, height, createdAt: serverTimestamp() });
  for (let i = 0; i < n; i++) {
    batch.set(doc(db, CHUNK_COL, `${id}_${String(i).padStart(3, '0')}`), {
      imageId: id, index: i, data: b64.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)
    });
  }
  await batch.commit();
  imgCache.set(id, Promise.resolve(dataUrl));
  return { id, chunks: n, docs: n + 1 };
}

/** يقرأ الصورة من مستنداتها ويرجع data URL (مع كاش في الذاكرة) */
export function getImageDataUrl(id) {
  if (!id) return Promise.resolve('');
  if (imgCache.has(id)) return imgCache.get(id);
  const p = (async () => {
    const metaSnap = await getDoc(doc(db, IMG_COL, id));
    if (!metaSnap.exists()) throw new Error('الصورة غير موجودة');
    const meta = metaSnap.data();
    const parts = await Promise.all(Array.from({ length: meta.chunks }, (_, i) =>
      getDoc(doc(db, CHUNK_COL, `${id}_${String(i).padStart(3, '0')}`))));
    const b64 = parts.map(s => (s.exists() ? s.data().data : '')).join('');
    if (b64.length !== meta.length) throw new Error('الصورة غير مكتملة');
    return `data:${meta.mime};base64,${b64}`;
  })();
  imgCache.set(id, p);
  p.catch(() => imgCache.delete(id));
  return p;
}

export async function deleteImage(id) {
  if (!id) return;
  try {
    const metaSnap = await getDoc(doc(db, IMG_COL, id));
    const n = metaSnap.exists() ? metaSnap.data().chunks : 0;
    const batch = writeBatch(db);
    for (let i = 0; i < n; i++) batch.delete(doc(db, CHUNK_COL, `${id}_${String(i).padStart(3, '0')}`));
    batch.delete(doc(db, IMG_COL, id));
    await batch.commit();
  } finally { imgCache.delete(id); }
}

/** يملأ كل <img data-img="ID"> بالصورة من Firestore */
export function hydrateImages(root = document) {
  $$('img[data-img]', root).forEach(img => {
    const id = img.dataset.img;
    if (!id || img.dataset.loaded === id) return;
    img.dataset.loaded = id;
    getImageDataUrl(id).then(src => { img.src = src; }).catch(() => { img.classList.add('img-failed'); });
  });
}

export async function imageStats() {
  const [a, b] = await Promise.all([getDocs(collection(db, IMG_COL)), getDocs(collection(db, CHUNK_COL))]);
  let bytes = 0;
  a.forEach(d => { bytes += Math.round((d.data().length || 0) * 0.75); });
  return { images: a.size, chunks: b.size, bytes };
}

/* ================= الإعدادات والأزرار ================= */
export const DEFAULT_NAV = [
  { id: 'nav_dashboard', name: 'لوحة التحكم', href: 'index.html', icon: 'dashboard', builtin: true, locked: true },
  { id: 'nav_products', name: 'المنتجات', href: 'products.html', icon: 'box', builtin: true },
  { id: 'nav_notifications', name: 'الإشعارات', href: 'notifications.html', icon: 'alert', builtin: true },
  { id: 'nav_orders', name: 'الطلبات', href: 'orders.html', icon: 'cart', builtin: true },
  { id: 'nav_suppliers', name: 'الموردين', href: 'suppliers.html', icon: 'truck', builtin: true },
  { id: 'nav_customers', name: 'العملاء', href: 'customers.html', icon: 'users', builtin: true },
  { id: 'nav_store', name: 'عرض المتجر', href: 'https://weshah-store.vercel.app/', icon: 'store', builtin: true, sep: true },
  { id: 'nav_settings', name: 'الإعدادات', href: 'settings.html', icon: 'settings', builtin: true, locked: true }
];
export const DEFAULT_ACTIONS = [
  { id: 'act_add_product', name: 'إضافة منتج', desc: 'أضف منتجًا جديدًا للمتجر', href: 'add-product.html', icon: 'plus', color: 'green', builtin: true },
  { id: 'act_orders', name: 'الطلبات', desc: 'راجع الطلبات', href: 'orders.html', icon: 'cart', color: 'gold', builtin: true },
  { id: 'act_suppliers', name: 'الموردين', desc: 'أدر الموردين والشراكات', href: 'suppliers.html', icon: 'truck', color: 'forest', builtin: true },
  { id: 'act_store', name: 'عرض المتجر', desc: 'شاهد المتجر كما يراه العملاء', href: 'https://weshah-store.vercel.app/', icon: 'store', color: 'dark', builtin: true },
  { id: 'act_expense', name: 'تسجيل مصروف', desc: 'سجّل إيجار أو إعلانات أو أي مصروف', href: 'index.html#expenses', icon: 'receipt', color: 'red', builtin: true },
  { id: 'act_coupons', name: 'أكواد الخصم', desc: 'أنشئ وتابع أكواد الخصم', href: 'index.html#coupons', icon: 'percent', color: 'purple', builtin: true },
  { id: 'act_pnl', name: 'قائمة الدخل', desc: 'الأرباح والخسائر بالتفصيل', href: 'index.html#pnl', icon: 'chart', color: 'blue', builtin: true }
];
export const DEFAULT_SECTIONS = { alerts: true, kpis: true, snapshot: true, chart: true, actions: true, topProducts: true, expenses: true, recentOrders: true };
export const SECTION_LABELS = {
  alerts: 'التنبيهات الذكية (خسارة، منتجات بلا تكلفة، مخزون)',
  kpis: 'بطاقات الأرباح والمبيعات',
  snapshot: 'عدّادات المنتجات والموردين والعملاء',
  chart: 'الرسم البياني (مبيعات / مصروفات / صافي)',
  actions: 'الأزرار السريعة',
  topProducts: 'أفضل المنتجات ربحًا',
  expenses: 'توزيع المصروفات',
  recentOrders: 'أحدث الطلبات'
};
/* محطات تتبّع الطلب (شريط القطار) — المستخدم يضيف ويعدّل ويحذف كما يشاء.
   status = الحالة المحاسبية التي تُسجَّل على الطلب عند الوصول للمحطة (تُستخدم في الأرباح والتقارير) */
export const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'completed', 'cancelled', 'refunded'];
export const DEFAULT_ORDER_FLOW = [
  { id: 'st_new', name: 'جديد', color: '#7b8794', status: 'pending' },
  { id: 'st_confirmed', name: 'تم التأكيد', color: '#2f80ed', status: 'processing' },
  { id: 'st_prep', name: 'قيد التجهيز', color: '#8e5bd6', status: 'processing' },
  { id: 'st_carrier', name: 'سُلّم لشركة الشحن', color: '#f2994a', status: 'shipped', msg: 'تم تسليم طلبك {number} لشركة الشحن وسيصلك قريبًا.' },
  { id: 'st_transit', name: 'في الطريق إليك', color: '#d9a21b', status: 'shipped' },
  { id: 'st_delivered', name: 'تم التسليم للعميل', color: '#1a8a5a', status: 'completed', msg: 'تم تسليم طلبك {number}. شكرًا لثقتك {name} 💚' },
  { id: 'st_returned', name: 'رجع من شركة الشحن', color: '#c0504a', status: 'refunded', restock: true, branch: true, msg: 'نأسف {name}، شركة الشحن أعادت طلبك {number}. سنتواصل معك لإعادة الشحن.' },
  { id: 'st_cancelled', name: 'مرفوض / ملغي', color: '#6c7871', status: 'cancelled', restock: true, branch: true }
];
export function normalizeFlow(raw) {
  if (!Array.isArray(raw) || raw.length < 2) return DEFAULT_ORDER_FLOW.map(x => ({ ...x }));
  const seen = new Set(), out = [];
  raw.forEach(x => {
    if (!x || !x.id || seen.has(x.id)) return; seen.add(x.id);
    out.push({ id: String(x.id), name: String(x.name || 'محطة').slice(0, 40), color: /^#[0-9a-f]{6}$/i.test(x.color || '') ? x.color : '#7b8794',
      status: ORDER_STATUSES.includes(x.status) ? x.status : 'processing', restock: !!x.restock, branch: !!x.branch, msg: String(x.msg || '').slice(0, 300) });
  });
  return out.length >= 2 ? out : DEFAULT_ORDER_FLOW.map(x => ({ ...x }));
}
export const DEFAULT_ACCOUNTING = { countMode: 'active', lowStock: 5, currency: 'ج.م' };

function mergeList(stored, defaults) {
  const out = Array.isArray(stored) ? stored.filter(x => x && x.id).map(x => ({ ...x })) : [];
  const ids = new Set(out.map(x => x.id));
  defaults.forEach(d => { if (!ids.has(d.id)) out.push({ ...d }); });
  // الإعدادات ولوحة التحكم لا تُخفى ولا تُحذف أبدًا حتى لا يضيع الوصول للوحة
  out.forEach(x => { const d = defaults.find(y => y.id === x.id); if (d && d.locked) { x.locked = true; x.visible = true; x.deleted = false; } });
  out.forEach(x=>{if(['nav_store','act_store'].includes(x.id))x.href='https://weshah-store.vercel.app/';});
  return out;
}

export function normalizeConfig(raw) {
  raw = raw || {};
  let actionsRaw = raw.actions;
  // ترحيل الأزرار القديمة (customButtons) إن وجدت
  if (!Array.isArray(actionsRaw) && Array.isArray(raw.customButtons)) {
    actionsRaw = [...DEFAULT_ACTIONS, ...raw.customButtons.map(b => ({ color: 'green', ...b, id: b.id || ('act_' + Math.random().toString(36).slice(2, 8)) }))];
  }
  return {
    siteNameAr: raw.siteNameAr || '',
    siteNameEn: raw.siteNameEn || 'WESHAH',
    logoImageId: raw.logoImageId || '',
    logoUrl: raw.logoUrl || '',
    nav: mergeList(raw.nav, DEFAULT_NAV),
    actions: mergeList(actionsRaw, DEFAULT_ACTIONS),
    sections: { ...DEFAULT_SECTIONS, ...(raw.sections || {}) },
    accounting: { ...DEFAULT_ACCOUNTING, ...(raw.accounting || {}) },
    orderFlow: normalizeFlow(raw.orderFlow),
    storefront: { shippingFee: 50, freeShippingOver: 1000, phone: '', announcement: '', tagline: '', about: '', email: '', returnPolicy: '', ...(raw.storefront || {}) }
  };
}

let CFG = normalizeConfig(readCachedConfig());
export const getConfig = () => CFG;
const cfgRef = () => doc(db, 'settings', 'site');

export async function loadConfig() {
  try {
    const snap = await getDoc(cfgRef());
    CFG = normalizeConfig(snap.exists() ? snap.data() : null);
    writeCachedConfig(CFG);
  } catch (err) {
    console.warn('تعذّر تحميل الإعدادات، نستخدم النسخة المحلية', err);
  }
  return CFG;
}

export async function saveConfig(patch) {
  await setDoc(cfgRef(), { ...patch, updatedAt: new Date().toISOString() }, { merge: true });
  CFG = normalizeConfig({ ...CFG, ...patch });
  writeCachedConfig(CFG);
  document.dispatchEvent(new CustomEvent('weshah:config', { detail: CFG }));
  return CFG;
}

/** يجلب الشعار من مستنداته ويطبّقه على كل الصفحة (مع كاش محلي) */
export async function refreshBrand(cfg = CFG) {
  let src = null;
  if (cfg.logoImageId) {
    const cached = readCachedLogo();
    if (cached && cached.id === cfg.logoImageId) src = cached.data;
    else {
      try { src = await getImageDataUrl(cfg.logoImageId); writeCachedLogo(cfg.logoImageId, src); }
      catch (e) { console.warn('تعذّر تحميل الشعار', e); }
    }
  }
  if (!src && cfg.logoUrl) src = cfg.logoUrl;
  paintBrand(cfg, src || LOGO_FALLBACK);
  return src || LOGO_FALLBACK;
}

/* ================= هيكل الصفحة ================= */
const pageFile = () => (location.pathname.split('/').pop() || 'index.html').toLowerCase();
const hrefFile = h => String(h).split('#')[0].split('?')[0].toLowerCase();
const isExternal = h => /^https?:\/\//i.test(h);

export const visibleItems = list => list.filter(x => x.visible !== false && !x.deleted);

function navLink(it, active) {
  const ext = isExternal(it.href) || it.newTab;
  const isActive = !ext && hrefFile(it.href) === active && !String(it.href).includes('#');
  return `<a href="${esc(safeHref(it.href))}" class="${isActive ? 'active' : ''}" ${ext ? 'target="_blank" rel="noopener"' : ''}>${svg(it.icon)}<span>${esc(it.name)}</span></a>`;
}

export function renderNav(cfg = CFG, active = pageFile()) {
  const nav = $('#sideNav');
  if (nav) {
    nav.innerHTML = visibleItems(cfg.nav).map(it => (it.sep ? '<div class="divider"></div>' : '') + navLink(it, active)).join('');
  }
  const bottom = $('#bottomNav');
  if (bottom) {
    const items = visibleItems(cfg.nav).slice(0, 4);
    bottom.innerHTML = items.map(it => {
      const ext = isExternal(it.href) || it.newTab;
      const on = !ext && hrefFile(it.href) === active && !String(it.href).includes('#');
      return `<a href="${esc(safeHref(it.href))}" class="${on ? 'active' : ''}" ${ext ? 'target="_blank" rel="noopener"' : ''}>${svg(it.icon)}<span>${esc(it.name)}</span></a>`;
    }).join('') + `<button type="button" onclick="toggleSidebar()">${svg('menu')}<span>المزيد</span></button>`;
  }
}

window.toggleSidebar = () => {
  $('#sidebar')?.classList.toggle('open');
  $('#sidebarOverlay')?.classList.toggle('show');
};

/**
 * يبني هيكل الصفحة الكامل داخل #app ويرجع عنصر المحتوى.
 * options: { title, sub, tools: html يوضع في الشريط العلوي }
 */
export function mountShell({ title, sub = '', tools = '' }) {
  const session = requireAuth();
  initTheme();
  registerSW();
  const name = session.user || '—';
  $('#app').innerHTML = `
    <div class="sidebar-overlay" id="sidebarOverlay" onclick="toggleSidebar()"></div>
    <div class="dash">
      <aside class="sidebar" id="sidebar" aria-label="القائمة الرئيسية">
        <a class="logo" href="index.html">
          <img src="${LOGO_FALLBACK}" alt="الشعار" class="logo-img js-logo">
          <span class="brand"><span class="js-name">WESHAH</span><small>ADMIN PANEL</small></span>
        </a>
        <nav class="side-nav" id="sideNav"></nav>
        <button class="btn-install js-install" type="button" onclick="installApp()" ${canInstall() && !isStandalone() ? '' : 'hidden'}>${svg('install')} تثبيت التطبيق</button>
        <button class="side-logout" type="button" onclick="logout()">${svg('logout')} تسجيل الخروج</button>
      </aside>
      <main class="main">
        <header class="topbar">
          <div class="topbar-left">
            <button class="icon-btn menu-btn" type="button" onclick="toggleSidebar()" aria-label="القائمة">${svg('menu')}</button>
            <div>
              <h1 id="pageTitle">${title}</h1>
              ${sub ? `<p>${sub}</p>` : ''}
            </div>
          </div>
          <div class="topbar-right">
            ${tools}
            <button class="icon-btn js-install" type="button" onclick="installApp()" title="تثبيت التطبيق" aria-label="تثبيت التطبيق" ${canInstall() && !isStandalone() ? '' : 'hidden'}>${svg('install')}</button>
            <button class="icon-btn" type="button" onclick="toggleTheme()" title="تبديل الوضع" aria-label="تبديل الوضع الليلي والنهاري"><svg class="ic js-theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"></svg></button>
            <div class="user-pill"><div class="avatar">${esc(name.charAt(0).toUpperCase())}</div><span>${esc(name)}</span></div>
          </div>
        </header>
        <div id="page"></div>
      </main>
    </div>
    <nav class="bottom-nav" id="bottomNav" aria-label="تنقل سريع"></nav>`;
  initTheme();
  renderNav(CFG);
  paintBrandFromCache();
  document.addEventListener('weshah:config', e => { renderNav(e.detail); refreshBrand(e.detail); });
  // أغلق القائمة الجانبية عند الضغط على أي رابط (للجوال)
  $('#sideNav').addEventListener('click', e => { if (e.target.closest('a')) { $('#sidebar').classList.remove('open'); $('#sidebarOverlay').classList.remove('show'); } });
  // حدّث الإعدادات والشعار من Firestore في الخلفية
  loadConfig().then(c => { renderNav(c); refreshBrand(c); document.dispatchEvent(new CustomEvent('weshah:config-ready', { detail: c })); });
  return $('#page');
}
