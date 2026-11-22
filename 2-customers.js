import {
  mountShell,
  db,
  collection,
  getDocs,
  openModal,
  getSession,
  closeModal,
} from "./weshah-core.js";
import {
  customerRows,
  searchCustomers,
  customerTable,
  customerDetails,
} from "./customer-view.js";
const page = mountShell({
  title: "العملاء",
  sub: "بيانات العملاء والطلبات عبر جلسة الإدارة الحالية. عرض للقراءة فقط.",
});
page.innerHTML =
  '<section class="customer-page"><div class="customer-tools"><input type="search" id="customerSearch" aria-label="بحث بالاسم أو الهاتف أو البريد" placeholder="بحث بالاسم أو الهاتف أو البريد"><button type="button" class="btn btn-primary" id="customerReload">إعادة القراءة</button><span id="customerCount"></span></div><div id="customerStatus" role="status" aria-live="polite"></div><div id="customerList"></div></section>';
const $ = (id) => document.getElementById(id);
let rows = [],
  loading = 0,
  sessionKey = "";
const key = () => {
  const s = getSession();
  return s ? JSON.stringify([s.user, s.time, s.exp]) : "";
};
function clear() {
  rows = [];
  $("customerList").replaceChildren();
  $("customerCount").textContent = "";
  closeModal();
}
function draw() {
  if (!sessionKey || key() !== sessionKey) {
    clear();
    return;
  }
  const shown = searchCustomers(rows, $("customerSearch").value);
  $("customerList").innerHTML = customerTable(shown);
  $("customerCount").textContent = `${shown.length} من ${rows.length} عميل`;
}
async function load() {
  const generation = ++loading;
  clear();
  sessionKey = key();
  if (!sessionKey) {
    $("customerStatus").textContent =
      "انتهت جلسة الإدارة. سجّل الدخول بنفس بياناتك.";
    return;
  }
  $("customerReload").disabled = true;
  $("customerStatus").setAttribute("role", "status");
  $("customerStatus").textContent = "جارٍ قراءة البيانات الخاصة…";
  const [customers, orders] = await Promise.allSettled([
    getDocs(collection(db, "customers")),
    getDocs(collection(db, "orders")),
  ]);
  if (generation !== loading) return;
  $("customerReload").disabled = false;
  if (key() !== sessionKey) {
    clear();
    $("customerStatus").textContent = "تغيرت جلسة الإدارة. أعد تسجيل الدخول.";
    return;
  }
  if (customers.status !== "fulfilled") {
    clear();
    $("customerStatus").setAttribute("role", "alert");
    $("customerStatus").textContent =
      "تعذّرت قراءة العملاء. لم نعرض بيانات محفوظة قديمة. أعد القراءة أو سجّل الدخول إذا انتهت الجلسة.";
    return;
  }
  const records = customers.value.docs.map((d) => ({ ...d.data(), id: d.id }));
  const orderRows =
    orders.status === "fulfilled"
      ? orders.value.docs.map((d) => ({ ...d.data(), id: d.id }))
      : null;
  rows = customerRows(records, orderRows);
  $("customerStatus").setAttribute(
    "role",
    orderRows === null ? "alert" : "status",
  );
  $("customerStatus").textContent =
    orderRows === null
      ? "تمت قراءة العملاء، لكن تعذّرت قراءة الطلبات. أعداد الطلبات غير متاحة."
      : rows.length
        ? "تمت قراءة العملاء والطلبات. لا تظهر هنا بيانات موردين أو سجلات محاسبية مفترضة."
        : "لا توجد سجلات عملاء في القراءة الحالية.";
  draw();
}
$("customerSearch").addEventListener("input", draw);
$("customerReload").addEventListener("click", load);
page.addEventListener("click", (e) => {
  const button = e.target.closest("[data-customer]");
  if (!button) return;
  if (key() !== sessionKey) {
    clear();
    return;
  }
  const row = rows.find((r) => r.id === button.dataset.customer);
  if (row)
    openModal({
      title: "بيانات العميل",
      body: customerDetails(row),
      hideSave: true,
      cancelLabel: "إغلاق",
    });
});
// A session change clears private content, including an open details dialog.
window.addEventListener("storage", () => {
  if (key() !== sessionKey) {
    loading++;
    clear();
    $("customerReload").disabled = false;
    $("customerStatus").textContent =
      "تغيرت جلسة الإدارة. أعد القراءة بعد تسجيل الدخول.";
  }
});
setInterval(() => {
  if (sessionKey && key() !== sessionKey) {
    loading++;
    clear();
    sessionKey = "";
    $("customerReload").disabled = false;
    $("customerStatus").textContent =
      "انتهت أو تغيرت جلسة الإدارة. أعد تسجيل الدخول.";
  }
}, 15000);
window.addEventListener("pageshow", (e) => {
  if (e.persisted) load();
});
load();
