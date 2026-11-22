/* =====================================================================
   WESHAH — محرك المحاسبة (دوال نقية بدون Firebase، قابلة للاختبار)
   الأرباح · الخسائر · الخصومات · أكواد الخصم · المخزون · نقطة التعادل
   ===================================================================== */

/* ---------- أدوات أساسية ---------- */
export const r2 = n => Math.round((Number(n) || 0) * 100) / 100;

const AR_DIGITS = /[٠-٩]/g;
export const num = v => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).replace(AR_DIGITS, d => d.charCodeAt(0) - 0x0660).replace(/[٬,]/g, '').replace(/[^\d.\-]/g, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};
const has = v => v !== null && v !== undefined && v !== '';

export function toDate(v) {
  if (v === null || v === undefined || v === '') return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v.toDate === 'function') { try { return v.toDate(); } catch (_) { return null; } }
  if (typeof v === 'object' && has(v.seconds)) return new Date(v.seconds * 1000);
  if (typeof v === 'number') return new Date(v < 1e12 ? v * 1000 : v);
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

export const startOfDay = d => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export const endOfDay = d => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const pad = n => String(n).padStart(2, '0');
export const dayKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const toInputDate = d => (d ? dayKey(d) : '');

/* ---------- حالات الطلب ---------- */
export const STATUS_LABELS = {
  pending: 'بانتظار الدفع', processing: 'قيد التجهيز', shipped: 'قيد الشحن',
  completed: 'مكتمل', cancelled: 'ملغي', refunded: 'مسترجع'
};
export const STATUS_BADGE = {
  pending: 'gray', processing: 'blue', shipped: 'gold', completed: 'green', cancelled: 'red', refunded: 'red'
};
const STATUS_MAP = {
  completed: ['completed', 'complete', 'delivered', 'done', 'paid', 'مكتمل', 'تم التسليم', 'مدفوع', 'تم'],
  shipped: ['shipped', 'shipping', 'out_for_delivery', 'قيد الشحن', 'تم الشحن'],
  cancelled: ['cancelled', 'canceled', 'ملغي', 'ملغى', 'الغاء', 'إلغاء'],
  refunded: ['refunded', 'returned', 'return', 'مسترجع', 'مرتجع', 'مسترد'],
  processing: ['processing', 'confirmed', 'preparing', 'قيد التجهيز', 'مؤكد']
};
export function normStatus(s) {
  const k = String(s ?? '').trim().toLowerCase();
  for (const [norm, list] of Object.entries(STATUS_MAP)) if (list.includes(k)) return norm;
  return 'pending';
}

/** أي الطلبات تدخل في حساب الإيراد؟ */
export const COUNT_MODES = {
  active: { label: 'كل الطلبات عدا الملغي والمسترجع', test: s => s !== 'cancelled' && s !== 'refunded' },
  fulfilled: { label: 'المشحونة والمكتملة فقط', test: s => s === 'shipped' || s === 'completed' },
  completed: { label: 'المكتملة فقط', test: s => s === 'completed' }
};
export const isCounted = (status, mode = 'active') => (COUNT_MODES[mode] || COUNT_MODES.active).test(status);

/* ---------- تطبيع البيانات ---------- */
export function normalizeProducts(raw = []) {
  return raw.map(p => ({
    id: String(p.id ?? ''),
    name: String(p.name ?? p.title ?? '—'),
    category: String(p.category ?? ''),
    price: num(p.price),
    cost: num(p.cost ?? p.costPrice ?? p.purchasePrice),
    costKnown: has(p.cost ?? p.costPrice ?? p.purchasePrice),
    stock: has(p.stock ?? p.quantity ?? p.qty) ? num(p.stock ?? p.quantity ?? p.qty) : null,
    imageId: p.imageId || '',
    image: p.image || '',
    raw: p
  }));
}

function productIndex(products) {
  const byId = new Map(), byName = new Map();
  products.forEach(p => {
    if (p.id) byId.set(p.id, p);
    if (p.name) byName.set(p.name.trim().toLowerCase(), p);
  });
  return { byId, byName };
}

export function normalizeOrder(o, idx) {
  const rawItems = o.items || o.products || o.cart || o.lines || [];
  const items = Array.isArray(rawItems) ? rawItems : [];
  const lines = items.map(it => {
    const qty = num(it.qty ?? it.quantity ?? it.count ?? 1) || 1;
    const price = num(it.price ?? it.unitPrice ?? it.salePrice);
    const key = String(it.productId ?? it.id ?? '');
    const nm = String(it.name ?? it.title ?? '').trim().toLowerCase();
    const p = (idx && (idx.byId.get(key) || idx.byName.get(nm))) || null;
    const costRaw = it.cost ?? it.costPrice ?? (p && p.costKnown ? p.cost : undefined);
    const costKnown = has(costRaw);
    const cost = num(costRaw);
    return {
      key: key || nm || '—',
      name: String(it.name ?? it.title ?? (p && p.name) ?? '—'),
      category: String(it.category ?? (p && p.category) ?? ''),
      qty, price, cost, costKnown,
      revenue: r2(price * qty),
      cogs: r2(cost * qty)
    };
  });

  let itemsTotal = r2(lines.reduce((s, l) => s + l.revenue, 0));
  const discount = r2(num(o.discount ?? o.discountAmount ?? o.couponDiscount ?? 0));
  const shipping = r2(num(o.shipping ?? o.shippingFee ?? o.deliveryFee ?? 0));
  const shipCost = r2(num(o.shippingCost ?? o.courierCost ?? 0));
  const fees = r2(num(o.fees ?? o.paymentFees ?? 0));
  const totalRaw = o.total ?? o.amount ?? o.price;

  let subtotal, usableLines = lines.length > 0 && itemsTotal > 0;
  if (usableLines) {
    subtotal = itemsTotal;
  } else if (has(o.subtotal ?? o.itemsTotal)) {
    subtotal = r2(num(o.subtotal ?? o.itemsTotal));
  } else {
    subtotal = r2(num(totalRaw) - shipping + discount);
  }
  const netSales = r2(subtotal - discount);
  const total = has(totalRaw) ? r2(num(totalRaw)) : r2(netSales + shipping);
  const cogs = r2(lines.reduce((s, l) => s + l.cogs, 0));

  let coupon = o.couponCode ?? o.coupon ?? o.discountCode ?? o.promoCode ?? '';
  if (coupon && typeof coupon === 'object') coupon = coupon.code || '';
  coupon = String(coupon).trim().toUpperCase();

  const status = normStatus(o.status);
  return {
    id: String(o.id ?? ''),
    number: o.orderNumber ?? String(o.id ?? '').slice(0, 6),
    customer: String(o.customerName ?? o.customer ?? o.name ?? '—'),
    date: toDate(o.createdAt ?? o.date ?? o.created ?? o.timestamp),
    status,
    lines: usableLines ? lines : [],
    subtotal, discount, shipping, shipCost, fees, total, netSales, cogs,
    profit: r2(netSales - cogs - shipCost - fees + shipping),
    coupon,
    paymentMethod: String(o.paymentMethod ?? o.payment ?? ''),
    missingCost: !usableLines || lines.some(l => !l.costKnown),
    raw: o
  };
}

export function normalizeExpense(e) {
  return {
    id: String(e.id ?? ''),
    title: String(e.title ?? e.name ?? 'مصروف'),
    amount: r2(num(e.amount)),
    category: String(e.category || 'أخرى'),
    date: toDate(e.date ?? e.createdAt),
    note: String(e.note ?? '')
  };
}

/* ---------- الفترات الزمنية ---------- */
export const RANGE_LABELS = {
  today: 'اليوم', yesterday: 'أمس', '7d': 'آخر 7 أيام', '30d': 'آخر 30 يومًا',
  month: 'هذا الشهر', lastMonth: 'الشهر الماضي', year: 'هذه السنة', all: 'كل الفترات', custom: 'فترة مخصصة'
};

export function makeRange(key, now = new Date(), custom = {}) {
  const today = startOfDay(now);
  let from = null, to = null;
  switch (key) {
    case 'today': from = today; to = endOfDay(today); break;
    case 'yesterday': from = addDays(today, -1); to = endOfDay(from); break;
    case '7d': from = addDays(today, -6); to = endOfDay(today); break;
    case '30d': from = addDays(today, -29); to = endOfDay(today); break;
    case 'month': from = new Date(today.getFullYear(), today.getMonth(), 1); to = endOfDay(today); break;
    case 'lastMonth':
      from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      to = endOfDay(new Date(today.getFullYear(), today.getMonth(), 0)); break;
    case 'year': from = new Date(today.getFullYear(), 0, 1); to = endOfDay(today); break;
    case 'custom':
      from = custom.from ? startOfDay(custom.from) : null;
      to = custom.to ? endOfDay(custom.to) : null;
      break;
    default: key = 'all';
  }
  let prev = null;
  if (from && to) {
    const span = Math.round((startOfDay(to) - startOfDay(from)) / 86400000) + 1;
    if (key === 'month' || key === 'lastMonth') {
      const pf = new Date(from.getFullYear(), from.getMonth() - 1, 1);
      prev = { from: pf, to: endOfDay(new Date(from.getFullYear(), from.getMonth(), 0)) };
    } else {
      prev = { from: addDays(from, -span), to: endOfDay(addDays(from, -1)) };
    }
  }
  return { key, label: RANGE_LABELS[key] || RANGE_LABELS.all, from, to, prev };
}

const inRange = (d, from, to, includeUndated) => {
  if (!from && !to) return true;
  if (!d) return includeUndated;
  return (!from || d >= from) && (!to || d <= to);
};

/* ---------- التجميع ---------- */
export function aggregate(orders, expenses, countMode = 'active') {
  const counted = orders.filter(o => isCounted(o.status, countMode));
  const sum = (arr, f) => r2(arr.reduce((s, x) => s + f(x), 0));

  const grossSales = sum(counted, o => o.subtotal);
  const discounts = sum(counted, o => o.discount);
  const netSales = sum(counted, o => o.netSales);
  const cogs = sum(counted, o => o.cogs);
  const grossProfit = r2(netSales - cogs);
  const shippingCollected = sum(counted, o => o.shipping);
  const shipCost = sum(counted, o => o.shipCost);
  const fees = sum(counted, o => o.fees);
  const expensesTotal = sum(expenses, e => e.amount);
  const netProfit = r2(grossProfit + shippingCollected - shipCost - fees - expensesTotal);

  const statusCounts = {};
  orders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
  const refunded = orders.filter(o => o.status === 'refunded');
  const cancelled = orders.filter(o => o.status === 'cancelled');
  const orderCount = counted.length;
  const itemsSold = counted.reduce((s, o) => s + o.lines.reduce((a, l) => a + l.qty, 0), 0);

  const grossMargin = netSales > 0 ? grossProfit / netSales : 0;
  const netMargin = netSales > 0 ? netProfit / netSales : 0;
  const fixedCosts = r2(expensesTotal + fees + shipCost - shippingCollected);
  const breakEven = grossMargin > 0 ? r2(Math.max(fixedCosts, 0) / grossMargin) : null;

  return {
    orderCount, itemsSold, grossSales, discounts, netSales, cogs, grossProfit,
    shippingCollected, shipCost, fees, expensesTotal, netProfit,
    grossMargin, netMargin, breakEven,
    avgOrder: orderCount ? r2(netSales / orderCount) : 0,
    discountRate: grossSales > 0 ? discounts / grossSales : 0,
    statusCounts,
    refunds: { count: refunded.length, value: sum(refunded, o => o.netSales) },
    cancelled: { count: cancelled.length, value: sum(cancelled, o => o.netSales) },
    missingCostOrders: counted.filter(o => o.missingCost).length,
    isLoss: netProfit < 0
  };
}

export const pctChange = (cur, prev) => {
  if (!prev) return cur ? null : 0;
  return (cur - prev) / Math.abs(prev);
};

/* ---------- السلاسل الزمنية للرسم ---------- */
function buildSeries(orders, expenses, from, to, countMode) {
  const counted = orders.filter(o => isCounted(o.status, countMode) && o.date);
  const dated = [...counted.map(o => o.date), ...expenses.filter(e => e.date).map(e => e.date)];
  if (!from) from = dated.length ? startOfDay(new Date(Math.min(...dated))) : null;
  if (!to) to = dated.length ? endOfDay(new Date(Math.max(...dated))) : null;
  if (!from || !to) return { granularity: 'day', buckets: [] };

  const spanDays = Math.round((startOfDay(to) - startOfDay(from)) / 86400000) + 1;
  const granularity = spanDays <= 62 ? 'day' : 'month';
  const keyOf = granularity === 'day' ? dayKey : monthKey;
  const map = new Map();
  const cursor = new Date(from);
  if (granularity === 'month') cursor.setDate(1);
  let guard = 0;
  while (cursor <= to && guard++ < 800) {
    map.set(keyOf(cursor), { key: keyOf(cursor), date: new Date(cursor), sales: 0, orderProfit: 0, expenses: 0, orders: 0 });
    if (granularity === 'day') cursor.setDate(cursor.getDate() + 1);
    else cursor.setMonth(cursor.getMonth() + 1);
  }
  counted.forEach(o => {
    const b = map.get(keyOf(o.date));
    if (!b) return;
    b.sales = r2(b.sales + o.netSales);
    b.orderProfit = r2(b.orderProfit + o.profit);
    b.orders++;
  });
  expenses.forEach(e => {
    if (!e.date) return;
    const b = map.get(keyOf(e.date));
    if (b) b.expenses = r2(b.expenses + e.amount);
  });
  const buckets = [...map.values()].map(b => ({ ...b, net: r2(b.orderProfit - b.expenses) }));
  return { granularity, buckets };
}

/* ---------- المنتجات والأقسام ---------- */
function productPerformance(counted) {
  const prod = new Map(), cat = new Map();
  counted.forEach(o => {
    const itemsTotal = o.lines.reduce((s, l) => s + l.revenue, 0) || 1;
    o.lines.forEach(l => {
      const share = o.discount * (l.revenue / itemsTotal);
      const net = r2(l.revenue - share);
      const profit = r2(net - l.cogs);
      const a = prod.get(l.key) || { key: l.key, name: l.name, category: l.category, qty: 0, revenue: 0, cogs: 0, profit: 0, missingCost: false };
      a.qty += l.qty; a.revenue = r2(a.revenue + net); a.cogs = r2(a.cogs + l.cogs); a.profit = r2(a.profit + profit);
      if (!l.costKnown) a.missingCost = true;
      prod.set(l.key, a);
      const ck = l.category || 'بدون قسم';
      const c = cat.get(ck) || { name: ck, qty: 0, revenue: 0, profit: 0 };
      c.qty += l.qty; c.revenue = r2(c.revenue + net); c.profit = r2(c.profit + profit);
      cat.set(ck, c);
    });
  });
  return { products: [...prod.values()], categories: [...cat.values()].sort((a, b) => b.revenue - a.revenue) };
}

function expenseByCategory(expenses) {
  const m = new Map();
  expenses.forEach(e => m.set(e.category, r2((m.get(e.category) || 0) + e.amount)));
  return [...m.entries()].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
}

/* ---------- أكواد الخصم ---------- */
export function normalizeCoupon(c) {
  return {
    id: String(c.id ?? ''),
    code: String(c.code ?? '').trim().toUpperCase(),
    type: c.type === 'fixed' ? 'fixed' : 'percent',
    value: num(c.value),
    minOrder: num(c.minOrder),
    maxDiscount: has(c.maxDiscount) && num(c.maxDiscount) > 0 ? num(c.maxDiscount) : null,
    usageLimit: has(c.usageLimit) && num(c.usageLimit) > 0 ? num(c.usageLimit) : null,
    startsAt: toDate(c.startsAt),
    expiresAt: toDate(c.expiresAt),
    active: c.active !== false,
    note: String(c.note ?? ''),
    productId: c.productId ? String(c.productId) : '',       // كود خاص بمنتج واحد فقط
    productName: String(c.productName ?? ''),
    minQty: has(c.minQty) && num(c.minQty) > 0 ? num(c.minQty) : null,
    exact: c.exact === true                                    // وقت دقيق (دقائق/ساعات) بدل نهاية اليوم
  };
}

/* ---------- مدة الكود (تحديد يدوي بالكامل) ---------- */
export const DURATION_UNITS = {
  minute: 'دقيقة', hour: 'ساعة', day: 'يوم', week: 'أسبوع', month: 'شهر', year: 'سنة'
};
/** يضيف مدة لتاريخ بداية: الأشهر والسنوات تقويمية (31 يناير + شهر = آخر فبراير) */
export function computeExpiry(start, amount, unit) {
  const n = num(amount);
  const d = new Date(start);
  if (!(n > 0) || isNaN(d)) return null;
  switch (unit) {
    case 'minute': return new Date(d.getTime() + n * 60000);
    case 'hour': return new Date(d.getTime() + n * 3600000);
    case 'day': return new Date(d.getTime() + n * 86400000);
    case 'week': return new Date(d.getTime() + n * 7 * 86400000);
    case 'month': case 'year': {
      const months = unit === 'year' ? n * 12 : n;
      const whole = Math.trunc(months), frac = months - whole;
      const day = d.getDate();
      const r = new Date(d); r.setDate(1); r.setMonth(r.getMonth() + whole);
      const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
      r.setDate(Math.min(day, last));
      if (frac) r.setTime(r.getTime() + frac * 30 * 86400000);
      return r;
    }
    default: return null;
  }
}
/** نص مدة متبقية مثل «٢ يوم و٣ ساعة» */
export function fmtRemaining(ms) {
  if (ms <= 0) return 'انتهى';
  const m = Math.floor(ms / 60000), d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mi = m % 60;
  const parts = [];
  if (d) parts.push(`${fmtNum(d, 0)} يوم`);
  if (h) parts.push(`${fmtNum(h, 0)} ساعة`);
  if (mi && d < 2) parts.push(`${fmtNum(mi, 0)} دقيقة`);
  return parts.slice(0, 2).join(' و') || 'أقل من دقيقة';
}

export function couponStatus(c, used = 0, now = new Date()) {
  if (!c.active) return 'inactive';
  const st = c.exact ? c.startsAt : (c.startsAt && startOfDay(c.startsAt));
  const en = c.exact ? c.expiresAt : (c.expiresAt && endOfDay(c.expiresAt));
  if (st && now < st) return 'scheduled';
  if (en && now > en) return 'expired';
  if (c.usageLimit && used >= c.usageLimit) return 'exhausted';
  return 'active';
}
export const COUPON_STATUS_LABELS = {
  active: 'فعّال', inactive: 'متوقف', expired: 'منتهي', exhausted: 'استُنفد', scheduled: 'لم يبدأ'
};
export const COUPON_STATUS_BADGE = { active: 'green', inactive: 'gray', expired: 'red', exhausted: 'gold', scheduled: 'blue' };

/** تطبيق كود خصم على مبلغ — يرجع {ok, discount, finalAmount, reason} */
export function applyCoupon(coupon, subtotal, { now = new Date(), used = 0, eligible = null, qty = null } = {}) {
  const orderAmount = r2(num(subtotal));
  // كود المنتج الواحد يخصم فقط من سعر ذلك المنتج (eligible) لا من كل السلة
  const amount = coupon.productId && eligible !== null ? r2(num(eligible)) : orderAmount;
  const st = couponStatus(coupon, used, now);
  const reasons = {
    inactive: 'الكود متوقف', expired: 'انتهت صلاحية الكود',
    exhausted: 'تم استنفاد عدد مرات الاستخدام', scheduled: 'لم تبدأ صلاحية الكود بعد'
  };
  if (st !== 'active') return { ok: false, discount: 0, finalAmount: amount, reason: reasons[st] };
  if (coupon.productId && eligible !== null && amount <= 0) {
    return { ok: false, discount: 0, finalAmount: orderAmount, reason: 'الكود خاص بمنتج غير موجود في الطلب' };
  }
  if (coupon.minOrder && orderAmount < coupon.minOrder) {
    return { ok: false, discount: 0, finalAmount: orderAmount, reason: `الحد الأدنى للطلب ${coupon.minOrder}` };
  }
  if (coupon.minQty && qty !== null && qty < coupon.minQty) {
    return { ok: false, discount: 0, finalAmount: orderAmount, reason: `الحد الأدنى للكمية ${coupon.minQty}` };
  }
  let d = coupon.type === 'percent' ? amount * coupon.value / 100 : coupon.value;
  if (coupon.maxDiscount) d = Math.min(d, coupon.maxDiscount);
  d = r2(Math.min(Math.max(d, 0), amount));
  return { ok: true, discount: d, finalAmount: r2(orderAmount - d), reason: '' };
}

function couponPerformance(coupons, allCounted, rangeCounted, now) {
  const usedAll = new Map(), perf = new Map();
  allCounted.forEach(o => { if (o.coupon) usedAll.set(o.coupon, (usedAll.get(o.coupon) || 0) + 1); });
  rangeCounted.forEach(o => {
    if (!o.coupon) return;
    const p = perf.get(o.coupon) || { uses: 0, discount: 0, sales: 0 };
    p.uses++; p.discount = r2(p.discount + o.discount); p.sales = r2(p.sales + o.netSales);
    perf.set(o.coupon, p);
  });
  const known = new Set(coupons.map(c => c.code));
  const rows = coupons.map(c => {
    const used = usedAll.get(c.code) || 0;
    const p = perf.get(c.code) || { uses: 0, discount: 0, sales: 0 };
    return { ...c, used, status: couponStatus(c, used, now), periodUses: p.uses, periodDiscount: p.discount, periodSales: p.sales };
  });
  // أكواد ظهرت في الطلبات لكن غير معرّفة في المجموعة
  perf.forEach((p, code) => {
    if (!known.has(code)) rows.push({
      id: '', code, type: 'percent', value: 0, status: 'unknown', undefinedCode: true,
      used: usedAll.get(code) || 0, periodUses: p.uses, periodDiscount: p.discount, periodSales: p.sales
    });
  });
  return rows;
}

/* ---------- المخزون ---------- */
function inventory(products, lowStock) {
  const tracked = products.filter(p => p.stock !== null);
  const value = r2(tracked.reduce((s, p) => s + Math.max(p.stock, 0) * p.cost, 0));
  const retail = r2(tracked.reduce((s, p) => s + Math.max(p.stock, 0) * p.price, 0));
  return {
    units: tracked.reduce((s, p) => s + Math.max(p.stock, 0), 0),
    value, retail, potentialProfit: r2(retail - value),
    outOfStock: tracked.filter(p => p.stock <= 0),
    low: tracked.filter(p => p.stock > 0 && p.stock <= lowStock),
    noCost: products.filter(p => !p.costKnown || p.cost === 0)
  };
}

/* ---------- الحساب الرئيسي ---------- */
export function computeStats({
  orders = [], products = [], expenses = [], coupons = [],
  range, countMode = 'active', lowStock = 5, now = new Date()
}) {
  range = range || makeRange('all', now);
  const prods = normalizeProducts(products);
  const idx = productIndex(prods);
  const allOrders = orders.map(o => normalizeOrder(o, idx));
  const allExpenses = expenses.map(normalizeExpense);
  const allCoupons = coupons.map(normalizeCoupon);
  const isAll = !range.from && !range.to;

  const ordersIn = allOrders.filter(o => inRange(o.date, range.from, range.to, isAll));
  const expensesIn = allExpenses.filter(e => inRange(e.date, range.from, range.to, isAll));
  const cur = aggregate(ordersIn, expensesIn, countMode);

  let prev = null, changes = null;
  if (range.prev) {
    const po = allOrders.filter(o => inRange(o.date, range.prev.from, range.prev.to, false));
    const pe = allExpenses.filter(e => inRange(e.date, range.prev.from, range.prev.to, false));
    prev = aggregate(po, pe, countMode);
    changes = {
      netSales: pctChange(cur.netSales, prev.netSales),
      netProfit: pctChange(cur.netProfit, prev.netProfit),
      orderCount: pctChange(cur.orderCount, prev.orderCount),
      expensesTotal: pctChange(cur.expensesTotal, prev.expensesTotal),
      grossProfit: pctChange(cur.grossProfit, prev.grossProfit)
    };
  }

  const countedIn = ordersIn.filter(o => isCounted(o.status, countMode));
  const countedAll = allOrders.filter(o => isCounted(o.status, countMode));
  const perf = productPerformance(countedIn);

  return {
    range, countMode, totals: cur, prev, changes,
    orders: ordersIn.sort((a, b) => (b.date || 0) - (a.date || 0)),
    allOrders, expenses: expensesIn.sort((a, b) => (b.date || 0) - (a.date || 0)),
    allExpenses,
    products: prods,
    series: buildSeries(allOrders, allExpenses, range.from, range.to, countMode),
    topProducts: [...perf.products].sort((a, b) => b.profit - a.profit),
    categories: perf.categories,
    productPerf: new Map(perf.products.map(p => [p.key, p])),
    expenseCategories: expenseByCategory(expensesIn),
    coupons: couponPerformance(allCoupons, countedAll, countedIn, now),
    inventory: inventory(prods, lowStock)
  };
}

/* ---------- تنسيق وتصدير ---------- */
export const fmtNum = (n, digits = 2) => new Intl.NumberFormat('ar-EG', { maximumFractionDigits: digits }).format(r2(n));
export const fmtMoney = (n, cur = 'ج.م') => `${fmtNum(n)} ${cur}`;
export const fmtPct = (x, digits = 1) => `${new Intl.NumberFormat('ar-EG', { maximumFractionDigits: digits }).format(r2((x || 0) * 100))}٪`;
export const fmtDate = d => (d ? new Intl.DateTimeFormat('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' }).format(d) : '—');

export function toCSV(rows) {
  const esc = v => {
    let s = v === null || v === undefined ? '' : String(v);
    if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = "'" + s; // منع حقن الصيغ في Excel
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n');
}
