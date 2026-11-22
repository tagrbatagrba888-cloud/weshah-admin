/* =====================================================================
   WESHAH — محرك الباركود و QR (بدون أي مكتبات خارجية، يعمل بدون إنترنت)
   · QR Code: وضع البايت (UTF-8)، إصدارات 1–40، مستويات تصحيح L/M/Q/H
   · EAN-13 بمجموع تحقق صحيح · Code 128 (Set B)
   كل الدوال ترجع بيانات خام أو SVG نصي.
   ===================================================================== */

/* ===================== QR ===================== */
const ECC_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30]
];
const NUM_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81]
];
const ECC_INDEX = { L: 0, M: 1, Q: 2, H: 3 };
const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };

function numRawDataModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const na = Math.floor(ver / 7) + 2;
    r -= (25 * na - 10) * na - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}
const numDataCodewords = (ver, ecl) =>
  Math.floor(numRawDataModules(ver) / 8) - ECC_PER_BLOCK[ECC_INDEX[ecl]][ver] * NUM_BLOCKS[ECC_INDEX[ecl]][ver];

/* Reed–Solomon على GF(256) */
function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}
function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}
function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => { result[i] ^= gfMul(coef, factor); });
  }
  return result;
}

const utf8 = s => [...new TextEncoder().encode(s)];

/** يرجع {size, modules:boolean[][], version, ecl, mask} */
export function qrEncode(text, ecl = 'M', minVersion = 1) {
  const data = utf8(String(text));
  if (!(ecl in ECC_INDEX)) ecl = 'M';
  let ver, bitsUsed;
  for (ver = Math.max(1, minVersion); ; ver++) {
    if (ver > 40) throw new Error('النص طويل جدًا لرمز QR');
    const ccBits = ver < 10 ? 8 : 16;
    const need = 4 + ccBits + data.length * 8;
    if (data.length < (1 << ccBits) && need <= numDataCodewords(ver, ecl) * 8) { bitsUsed = need; break; }
  }
  // ---- بناء البيانات
  const bits = [];
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(0x4, 4); push(data.length, ver < 10 ? 8 : 16);
  data.forEach(b => push(b, 8));
  const cap = numDataCodewords(ver, ecl) * 8;
  push(0, Math.min(4, cap - bits.length));
  push(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) push(pad, 8);
  const dataCw = [];
  for (let i = 0; i < bits.length; i += 8) dataCw.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // ---- تقسيم إلى كتل + تصحيح الأخطاء + التداخل
  const nb = NUM_BLOCKS[ECC_INDEX[ecl]][ver], eccLen = ECC_PER_BLOCK[ECC_INDEX[ecl]][ver];
  const rawCw = Math.floor(numRawDataModules(ver) / 8);
  const shortBlocks = nb - rawCw % nb, shortLen = Math.floor(rawCw / nb);
  const div = rsDivisor(eccLen);
  const blocks = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const len = shortLen - eccLen + (i < shortBlocks ? 0 : 1);
    const dat = dataCw.slice(k, k + len); k += len;
    const ecc = rsRemainder(dat, div);
    if (i < shortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const all = [];
  for (let i = 0; i < blocks[0].length; i++)
    blocks.forEach((b, j) => { if (i !== shortLen - eccLen || j >= shortBlocks) all.push(b[i]); });

  // ---- رسم المصفوفة
  const size = ver * 4 + 17;
  const mod = Array.from({ length: size }, () => new Array(size).fill(false));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setF = (x, y, dark) => { mod[y][x] = dark; fn[y][x] = true; };

  for (let i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  const align = [];
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2, step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    const pos = [6];
    for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p);
    pos.forEach((px, i) => pos.forEach((py, j) => {
      if (!((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0))) align.push([px, py]);
    }));
  }
  align.forEach(([cx, cy]) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  });

  const drawFormat = mask => {
    const d = (ECC_FORMAT_BITS[ecl] << 3) | mask;
    let rem = d;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const fmt = ((d << 10) | rem) ^ 0x5412;
    const b = i => ((fmt >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) setF(8, i, b(i));
    setF(8, 7, b(6)); setF(8, 8, b(7)); setF(7, 8, b(8));
    for (let i = 9; i < 15; i++) setF(14 - i, 8, b(i));
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, b(i));
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, b(i));
    setF(8, size - 8, true);
  };
  drawFormat(0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
    const bitsV = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bitsV >>> i) & 1) !== 0, a = size - 11 + i % 3, b = Math.floor(i / 3);
      setF(a, b, bit); setF(b, a, bit);
    }
  }

  // وضع البيانات بالتعرّج
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
      if (!fn[y][x] && i < all.length * 8) { mod[y][x] = ((all[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
    }
  }

  // اختيار أفضل قناع
  const maskFns = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
  ];
  const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFns[m](x, y)) mod[y][x] = !mod[y][x]; };
  let best = 0, bestPen = Infinity;
  for (let m = 0; m < 8; m++) {
    applyMask(m); drawFormat(m);
    const p = penalty(mod, size);
    if (p < bestPen) { bestPen = p; best = m; }
    applyMask(m);
  }
  applyMask(best); drawFormat(best);
  return { size, modules: mod, version: ver, ecl, mask: best };
}

function penalty(mod, size) {
  let result = 0;
  const runPen = line => {
    let run = 1, p = 0;
    for (let i = 1; i < line.length; i++) {
      if (line[i] === line[i - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
    }
    return p;
  };
  const pat = [true, false, true, true, true, false, true];
  const finderPen = line => {
    let p = 0;
    for (let i = 0; i + 7 <= line.length; i++) {
      if (!pat.every((v, k) => line[i + k] === v)) continue;
      const lw = i >= 4 && [1, 2, 3, 4].every(k => !line[i - k]);
      const rw = i + 11 <= line.length && [7, 8, 9, 10].every(k => !line[i + k]);
      if (lw || rw) p += 40;
    }
    return p;
  };
  for (let y = 0; y < size; y++) { result += runPen(mod[y]) + finderPen(mod[y]); }
  for (let x = 0; x < size; x++) { const col = mod.map(r => r[x]); result += runPen(col) + finderPen(col); }
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const c = mod[y][x];
    if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) result += 3;
  }
  let dark = 0; mod.forEach(r => r.forEach(c => { if (c) dark++; }));
  const total = size * size;
  result += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
  return result;
}

/** SVG لرمز QR */
export function qrSvg(text, { ecl = 'M', scale = 6, margin = 4, fg = '#000', bg = '#fff' } = {}) {
  const q = qrEncode(text, ecl);
  const dim = q.size + margin * 2;
  let d = '';
  for (let y = 0; y < q.size; y++) for (let x = 0; x < q.size; x++) if (q.modules[y][x]) d += `M${x + margin},${y + margin}h1v1h-1z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${dim * scale}" height="${dim * scale}" shape-rendering="crispEdges"><rect width="${dim}" height="${dim}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
}

/* ===================== EAN-13 ===================== */
export function ean13Check(d12) {
  const s = String(d12).replace(/\D/g, '').slice(0, 12).padStart(12, '0');
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(s[i]) * (i % 2 === 0 ? 1 : 3);
  return String((10 - sum % 10) % 10);
}
export function ean13Valid(code) { return /^\d{13}$/.test(code) && ean13Check(code.slice(0, 12)) === code[12]; }
/** باركود عشوائي صالح: يبدأ بـ 2 (نطاق الاستخدام الداخلي للمتاجر) */
export function randomEan13() {
  const a = new Uint32Array(3);
  (globalThis.crypto || { getRandomValues: x => x.map(() => Math.random() * 4294967296) }).getRandomValues(a);
  let body = '2' + String(a[0]).padStart(10, '0').slice(-5) + String(a[1]).padStart(10, '0').slice(-6);
  body = body.slice(0, 12);
  return body + ean13Check(body);
}
const EAN_L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const EAN_G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const EAN_R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const EAN_PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function ean13Modules(code) {
  if (!ean13Valid(code)) throw new Error('باركود EAN-13 غير صالح (يجب 13 رقمًا بمجموع تحقق صحيح)');
  const par = EAN_PARITY[Number(code[0])];
  let m = '101';
  for (let i = 0; i < 6; i++) m += (par[i] === 'L' ? EAN_L : EAN_G)[Number(code[i + 1])];
  m += '01010';
  for (let i = 0; i < 6; i++) m += EAN_R[Number(code[i + 7])];
  return m + '101';
}

/* ===================== Code 128 (Set B) ===================== */
const C128 = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];
export const code128Table = C128;
export const code128Valid = s => /^[\x20-\x7e]{1,40}$/.test(s);

export function code128Modules(text) {
  if (!code128Valid(text)) throw new Error('Code 128 يقبل حروفًا إنجليزية وأرقامًا ورموزًا (حتى 40 حرفًا) بدون عربي');
  const codes = [104];                                    // Start B
  for (const ch of text) codes.push(ch.charCodeAt(0) - 32);
  let sum = codes[0];
  for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
  codes.push(sum % 103, 106);                             // checksum + stop
  let bits = '';
  codes.forEach(c => {
    [...C128[c]].forEach((w, i) => { bits += (i % 2 === 0 ? '1' : '0').repeat(Number(w)); });
  });
  return bits;
}

/* ===================== رسم الباركود ===================== */
/** type: 'ean13' | 'code128' */
export function barcodeSvg(value, type = 'ean13', { module = 2, height = 80, quiet = 10, fg = '#000', bg = '#fff', showText = true } = {}) {
  const bits = type === 'ean13' ? ean13Modules(value) : code128Modules(value);
  const textH = showText ? 16 : 0;
  const w = (bits.length + quiet * 2) * module, h = height + textH + 8;
  let bars = '';
  for (let i = 0; i < bits.length;) {
    if (bits[i] === '0') { i++; continue; }
    let j = i; while (j < bits.length && bits[j] === '1') j++;
    const guard = type === 'ean13' && (i < 3 || (i >= 45 && i < 50) || i >= 92);
    bars += `<rect x="${(i + quiet) * module}" y="4" width="${(j - i) * module}" height="${height + (guard && showText ? 6 : 0)}" fill="${fg}"/>`;
    i = j;
  }
  let text = '';
  if (showText) {
    const ty = height + 4 + 13;
    if (type === 'ean13') {
      const x0 = quiet * module;
      text = `<text x="${x0 - 3 * module}" y="${ty}" font-size="13" text-anchor="middle" font-family="monospace" fill="${fg}">${value[0]}</text>` +
        `<text x="${x0 + (3 + 21) * module}" y="${ty}" font-size="13" text-anchor="middle" font-family="monospace" letter-spacing="${module * 1.6}" fill="${fg}">${value.slice(1, 7)}</text>` +
        `<text x="${x0 + (3 + 42 + 5 + 21) * module}" y="${ty}" font-size="13" text-anchor="middle" font-family="monospace" letter-spacing="${module * 1.6}" fill="${fg}">${value.slice(7)}</text>`;
    } else {
      text = `<text x="${w / 2}" y="${ty}" font-size="13" text-anchor="middle" font-family="monospace" fill="${fg}">${String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h + (showText && type === 'ean13' ? 4 : 0)}" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${bg}"/>${bars}${text}</svg>`;
}

/** يحوّل SVG نصي إلى PNG (في المتصفح فقط) */
export function svgToPngBlob(svgText, scale = 3) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width * scale; c.height = img.height * scale;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); c.toBlob(b => (b ? resolve(b) : reject(new Error('تعذّر إنشاء الصورة'))), 'image/png');
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('تعذّر رسم الرمز')); };
    img.src = url;
  });
}
