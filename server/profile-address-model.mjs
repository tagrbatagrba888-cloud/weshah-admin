// Pure validation. Reuse on the trusted server with its own pinned dataset.
// Browser validation is UX only, never authority for canonical fields.
export const DATASET = 'egypt-capmas-2023-v1';
export class AddressError extends Error {
  constructor(code, message) { super(message); this.name = 'AddressError'; this.code = code; }
}
const fail = (code, message) => { throw new AddressError(code, message); };
export function text(value, max, min = 0) {
  if (typeof value !== 'string') fail('invalid-text', 'قيمة غير صالحة');
  const result = value.normalize('NFC').trim().replace(/\s+/gu, ' ');
  if (/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/u.test(result) || result.length < min || result.length > max)
    fail('invalid-text', 'راجع الحقول المطلوبة وطول النص');
  return result;
}
export function normalizePhone(value) {
  const n = text(value, 40, 1).replace(/[٠-٩]/g, x => String(x.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, x => String(x.charCodeAt(0) - 0x6f0)).replace(/[ ()-]/g, '').replace(/^\+/, '');
  if (!/^[0-9]{10,15}$/.test(n)) fail('invalid-phone', 'أدخل رقم موبايل صحيحًا من ١٠ إلى ١٥ رقمًا');
  return n;
}
export function registrationFields(input) {
  const fullName = text(input.fullName, 160, 2);
  // This is a display handle proposal only. It is NOT a login ID or uniqueness claim.
  const username = text(input.username, 40, 2);
  if (!/^[\p{L}\p{M}\p{N}_.-]+$/u.test(username)) fail('invalid-username', 'اسم المستخدم: حروف وأرقام ونقطة وشرطة فقط، بدون مسافات');
  const email = text(input.email, 254, 3);
  if (!/^\S+@\S+\.\S+$/.test(email)) fail('invalid-email', 'أدخل بريدًا صحيحًا');
  return { fullName, username, phone: normalizePhone(input.phone), email };
}
export function validateDataset(data) {
  if (data?.meta?.id !== DATASET || !Array.isArray(data.governorates) || !Array.isArray(data.centers) || !Array.isArray(data.localities))
    fail('dataset-unavailable', 'تعذّر تحميل دليل المناطق الصحيح');
  for (const [key, size] of [['governorates', 2], ['centers', 4], ['localities', 6]]) {
    const seen = new Set();
    for (const row of data[key]) {
      if (typeof row.code !== 'string' || !new RegExp(`^[0-9]{${size}}$`).test(row.code) || seen.has(row.code)) fail('dataset-invalid', 'تعذّر التحقق من دليل المناطق');
      text(row.name_ar, 1000, 1); seen.add(row.code);
    }
  }
  const governors = new Set(data.governorates.map(g => g.code));
  const centers = new Map(data.centers.map(c => [c.code, c]));
  for (const c of data.centers) if (!governors.has(c.governorate_code) || !c.code.startsWith(c.governorate_code)) fail('dataset-invalid', 'تسلسل المناطق غير صالح');
  for (const l of data.localities) {
    const c = centers.get(l.parent_code);
    if (!c || c.governorate_code !== l.governorate_code || !l.code.startsWith(c.code)) fail('dataset-invalid', 'تسلسل المناطق غير صالح');
  }
  return data;
}
export function validateAddress(input, data) {
  if (input?.datasetVersion !== DATASET || data?.meta?.id !== DATASET) fail('wrong-version', 'أعد تحميل دليل المناطق');
  const governorate = data.governorates.find(g => g.code === input.governorateCode);
  if (!governorate) fail('invalid-governorate', 'اختر المحافظة');
  const details = text(input.details, 1800, 8);
  if (input.mode === 'custom') {
    // No invented official code, no nearest-place inference.
    if (input.centerCode || input.localityCode) fail('mixed-custom-codes', 'راجع المنطقة غير المدرجة');
    return { datasetVersion: DATASET, mode: 'custom', verification: 'customer-entered',
      governorateCode: governorate.code, governorateName: governorate.name_ar,
      customCenter: text(input.customCenter, 100, 2), customLocality: text(input.customLocality, 100, 2), details };
  }
  if (input.mode !== 'listed') fail('invalid-mode', 'اختر طريقة إدخال المنطقة');
  const center = data.centers.find(c => c.code === input.centerCode && c.governorate_code === governorate.code);
  if (!center) fail('invalid-center', 'اختر المركز أو القسم التابع للمحافظة');
  const locality = data.localities.find(l => l.code === input.localityCode && l.parent_code === center.code && l.governorate_code === governorate.code);
  if (!locality) fail('invalid-locality', 'اختر القرية أو الحي التابع للمركز');
  return { datasetVersion: DATASET, mode: 'listed', verification: 'dated-directory-selection',
    governorateCode: governorate.code, governorateName: governorate.name_ar,
    centerCode: center.code, centerName: center.name_ar,
    localityCode: locality.code, localityName: locality.name_ar, details };
}
// Optional explicit legacy projection for future integration only. Not used by the UI.
// It does not save codes, infer shipping rates or claim a canonical address was persisted.
export function legacyProjection(address) {
  const area = address.mode === 'custom' ? [address.customCenter, address.customLocality] : [address.centerName, address.localityName];
  return { city: text(address.governorateName, 200, 1), address: text([...area, address.details].join('، '), 2000, 8) };
}
